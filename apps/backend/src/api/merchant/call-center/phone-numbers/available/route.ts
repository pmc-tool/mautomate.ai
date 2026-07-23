import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { checkPlanGate } from "../../../../../modules/platform/billing/plan-gate"
import {
  getNumberProvider,
  NumberType,
} from "../../../../../modules/call-center/telephony-providers"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"

/**
 * GET /merchant/call-center/phone-numbers/available
 *   ?provider=twilio|vonage&country=US&type=local|tollfree|mobile&contains=&limit=
 *
 * Search buyable phone numbers at the carrier. Tenant-scoped (merchant auth) +
 * plan-gated like the rest of the phone feature. Each result carries the flat
 * monthly rental in CREDITS (the same `phone_number_month` rate the rent cron
 * bills) — merchants never see carrier USD prices.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const gate = await checkPlanGate(req.scope, ctx.merchant.tenant_id, "phone")
  if (!gate.allowed) {
    return res.status(402).json({ message: gate.reason, upgrade_to: gate.upgrade_to })
  }

  const q = req.query as Record<string, string | undefined>
  const providerName = (q.provider ?? "twilio").toLowerCase()
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

  const type = (["local", "tollfree", "mobile"].includes(q.type ?? "")
    ? q.type
    : "local") as NumberType
  const country = (q.country ?? "US").toUpperCase().slice(0, 2)
  const contains = (q.contains ?? "").replace(/[^0-9A-Za-z*]/g, "").slice(0, 12)

  const r = await provider.search({
    country,
    type,
    contains: contains || undefined,
    limit: Math.min(Number(q.limit) || 20, 30),
  })
  if (!r.ok) {
    return res
      .status(502)
      .json({ message: r.error || "The carrier search failed. Try again." })
  }

  const monthly_credits = creditsFor("phone_number_month", 1)
  res.json({
    provider: provider.name,
    country,
    type,
    monthly_credits,
    numbers: (r.data ?? []).map((n) => ({ ...n, monthly_credits })),
  })
}
