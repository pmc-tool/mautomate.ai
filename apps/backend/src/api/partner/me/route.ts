import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { referralLink, resolvePartner, sumCents } from "../_helpers"

/**
 * GET /partner/me — the signed-in partner's profile + headline stats.
 * Response: { partner, referral_link, stats }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx

  const [referrals, commissions] = await Promise.all([
    svc.listPartnerReferrals({ partner_id: partner.id }, { take: 1000 }),
    svc.listPartnerCommissions({ partner_id: partner.id }, { take: 5000 }),
  ])

  const tenantIds = (referrals || []).map((r: any) => r.tenant_id)
  const tenants = tenantIds.length
    ? await svc.listTenants({ id: tenantIds }, { take: 1000 }).catch(() => [])
    : []
  const activeStores = (tenants || []).filter((t: any) => t.status === "live").length

  const pending = (commissions || []).filter((c: any) => c.status === "pending")
  const paid = (commissions || []).filter((c: any) => c.status === "paid")
  const requested = pending.filter((c: any) => c.payout_id)

  res.json({
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      company: partner.company,
      tier: partner.tier,
      commission_pct: partner.commission_pct,
      referral_code: partner.referral_code,
      payout_method: partner.payout_method ?? null,
    },
    referral_link: referralLink(partner),
    stats: {
      referred_stores: (referrals || []).length,
      active_stores: activeStores,
      pending_cents: sumCents(pending),
      requested_cents: sumCents(requested),
      paid_cents: sumCents(paid),
      lifetime_cents: sumCents(
        (commissions || []).filter((c: any) => c.status !== "void")
      ),
    },
  })
}
