import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePartner } from "../_helpers"

type Body = {
  name?: string
  company?: string | null
  payout_method?: string | null
}

/**
 * PUT /partner/profile — a partner may edit their own display name, company,
 * and payout details. Tier / commission / status / referral code stay
 * operator-controlled (console only).
 */
export const PUT = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx
  const body = req.body ?? {}

  const patch: Record<string, unknown> = { id: partner.id }
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim()
  if ("company" in body) patch.company = body.company ?? null
  if ("payout_method" in body) patch.payout_method = body.payout_method ?? null

  if (Object.keys(patch).length > 1) {
    await svc.updatePartners(patch)
  }

  const updated = await svc.retrievePartner(partner.id)
  res.json({
    partner: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      company: updated.company,
      tier: updated.tier,
      commission_pct: updated.commission_pct,
      referral_code: updated.referral_code,
      payout_method: updated.payout_method ?? null,
    },
  })
}
