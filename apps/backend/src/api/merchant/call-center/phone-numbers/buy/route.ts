import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"
import { checkPlanGate } from "../../../../../modules/platform/billing/plan-gate"
import { getLedger } from "../../../../../modules/platform/credits/metering"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { getNumberProvider } from "../../../../../modules/call-center/telephony-providers"

/**
 * POST /merchant/call-center/phone-numbers/buy
 *   { provider, e164, country, agent_id?, label? }
 *
 * Buy a phone number at the carrier and map it to this tenant (and optionally
 * an agent) in one step. Ordering is deliberate:
 *
 *   1. plan gate + global-uniqueness + agent-ownership checks (fail early)
 *   2. RESERVE the first month's rental credits (insufficient balance fails
 *      here, before we own anything at the carrier)
 *   3. carrier purchase — on failure the reservation is RELEASED (no charge)
 *   4. COMMIT the reservation (the merchant is now billed)
 *   5. point the carrier's inbound webhooks at us (non-fatal — logged onto the
 *      row as inbound_note when it fails; the number is already owned)
 *   6. create the tenant-scoped row
 *
 * From next month the existing phone-number-rent cron bills the same flat
 * `phone_number_month` rate. (A number bought ON the 1st can be billed twice
 * for that month in the worst case — accepted, operator-refundable.)
 */

const E164 = /^\+[1-9]\d{6,15}$/

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id

  const gate = await checkPlanGate(req.scope, tenant_id, "phone")
  if (!gate.allowed) {
    return res.status(402).json({ message: gate.reason, upgrade_to: gate.upgrade_to })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const providerName = String(body.provider ?? "twilio").toLowerCase()
  const e164 = typeof body.e164 === "string" ? body.e164.trim() : ""
  const country = String(body.country ?? "US").toUpperCase().slice(0, 2)
  const agent_id =
    typeof body.agent_id === "string" && body.agent_id.trim()
      ? body.agent_id.trim()
      : null
  const label =
    typeof body.label === "string" && body.label.trim() ? body.label.trim() : null

  if (!E164.test(e164)) {
    return res.status(400).json({ message: "e164 must be a valid E.164 number" })
  }
  const provider = getNumberProvider(providerName)
  if (!provider) {
    return res.status(400).json({ message: "unknown provider" })
  }
  if (!provider.isConfigured()) {
    return res.status(503).json({
      message:
        "This carrier isn't connected yet — our team is enabling it. Please try again shortly or contact support.",
    })
  }

  const cc: any = req.scope.resolve(CALL_CENTER_MODULE)

  // A number belongs to exactly one tenant, ever.
  const existing = await cc.listPhoneNumbers({ e164 }, { take: 1 })
  if (Array.isArray(existing) && existing.length) {
    return res.status(409).json({ message: "That number is already taken." })
  }

  if (agent_id) {
    const agent = await cc.retrievePlaybook(agent_id).catch(() => null)
    if (!agent || agent.tenant_id !== tenant_id) {
      return res.status(404).json({ message: "Agent not found for this store." })
    }
  }

  // 2. Reserve the first month BEFORE buying — no credits, no purchase.
  const ledger = getLedger(req.scope)
  const monthly = creditsFor("phone_number_month", 1)
  const rid = `cres_numbuy_${e164.replace(/^\+/, "")}`
  const reservation = await ledger.reserve(tenant_id, "phone_number_month", 1, {
    reservationId: rid,
  })
  if (!reservation.ok) {
    return res.status(402).json({
      message: `Buying a number costs ${monthly} credits/month and your balance can't cover the first month. Top up and try again.`,
    })
  }

  // 3. Carrier purchase.
  const bought = await provider.purchase(e164, country)
  if (!bought.ok || !bought.data) {
    await ledger.release(rid).catch(() => {})
    return res.status(502).json({
      message: bought.error
        ? `The carrier declined the purchase: ${bought.error}`
        : "The carrier declined the purchase. The number may have just been taken — search again.",
    })
  }

  // 4. The merchant now owns the number — bill the first month.
  await ledger
    .commit(rid, 1, { idempotencyKey: `number-buy:${e164}` })
    .catch(() => {})

  // 5. Point inbound at us. Non-fatal: the number is owned either way.
  const configured = await provider.configureInbound(
    bought.data.provider_number_id,
    e164,
    country
  )
  if (!configured.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[call-center] inbound webhook config failed for ${e164} (${provider.name}):`,
      configured.error
    )
  }

  // 6. Persist the tenant-scoped mapping.
  const created = await cc.createPhoneNumbers({
    tenant_id,
    e164,
    agent_id,
    label,
    provider: provider.name,
    provider_number_id: bought.data.provider_number_id,
    country,
    active: true,
  })

  res.status(201).json({
    phone_number: created,
    monthly_credits: monthly,
    inbound_configured: configured.ok,
    message: configured.ok
      ? `You now own ${e164}. Incoming calls will be answered by ${
          agent_id ? "your selected agent" : "no one until you attach an agent"
        }.`
      : `You now own ${e164}, but inbound routing needs a final step from our team — contact support if calls don't connect.`,
  })
}
