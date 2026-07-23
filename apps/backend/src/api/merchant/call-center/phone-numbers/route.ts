import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { resolveMerchant } from "../../_helpers"
import { checkPlanGate } from "../../../../modules/platform/billing/plan-gate"
import { numberProviderStatus } from "../../../../modules/call-center/telephony-providers"
import { creditsFor } from "../../../../modules/platform/pricing/price-book"

/**
 * /merchant/call-center/phone-numbers
 *
 * Manage the inbound phone numbers (DIDs) mapped to this merchant's agents.
 * STRICTLY tenant-scoped: every row is created with, and every read filtered by,
 * the caller's own tenant (from resolveMerchant). A merchant can only ever see
 * or touch their own numbers.
 */

const E164 = /^\+[1-9]\d{6,15}$/

/** GET — list this tenant's numbers. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const numbers = await cc.listPhoneNumbers(
      { tenant_id },
      { take: 200, order: { created_at: "DESC" } }
    )
    res.json({
      phone_numbers: numbers ?? [],
      providers: numberProviderStatus(),
      monthly_credits: creditsFor("phone_number_month", 1),
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list numbers" })
  }
}

/** POST — register a number for this tenant, optionally bound to an agent. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id

  // A phone number is a real monthly bill from Twilio — paid plans only.
  const gate = await checkPlanGate(req.scope, tenant_id, "phone")
  if (!gate.allowed) {
    return res.status(402).json({ message: gate.reason, upgrade_to: gate.upgrade_to })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const e164 = typeof body.e164 === "string" ? body.e164.trim() : ""
  const agent_id =
    typeof body.agent_id === "string" && body.agent_id.trim()
      ? body.agent_id.trim()
      : null
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : null

  if (!E164.test(e164)) {
    return res
      .status(400)
      .json({ message: "e164 must be a valid E.164 number, e.g. +61480123456" })
  }

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)

    // Global uniqueness: a number belongs to exactly one tenant. If it already
    // exists (any tenant), refuse — never reassign another tenant's number.
    const existing = await cc.listPhoneNumbers({ e164 }, { take: 1 })
    if (Array.isArray(existing) && existing.length) {
      return res
        .status(409)
        .json({ message: "That number is already registered." })
    }

    // If an agent is named, assert it belongs to THIS tenant (fail-closed).
    if (agent_id) {
      const agent = await cc.retrievePlaybook(agent_id).catch(() => null)
      if (!agent || agent.tenant_id !== tenant_id) {
        return res
          .status(404)
          .json({ message: "Agent not found for this store." })
      }
    }

    // BYO registration: the merchant owns this DID at their own carrier
    // account, so provider_number_id stays null (we never release it).
    const providerName = ["twilio", "vonage"].includes(
      String(body.provider ?? "").toLowerCase()
    )
      ? String(body.provider).toLowerCase()
      : "twilio"

    const created = await cc.createPhoneNumbers({
      tenant_id,
      e164,
      agent_id,
      label,
      provider: providerName,
      active: true,
    })
    res.status(201).json({ phone_number: created })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to register number" })
  }
}
