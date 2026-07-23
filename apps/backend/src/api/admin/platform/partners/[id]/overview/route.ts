import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"

const sum = (rows: Array<{ amount_cents?: number }>) =>
  rows.reduce((a, r) => a + (Number(r.amount_cents) || 0), 0)

/**
 * GET /admin/platform/partners/:id/overview — everything the console's partner
 * detail view needs: referrals (with store facts), commissions, payouts, totals.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partner = await svc.retrievePartner(req.params.id).catch(() => null)
  if (!partner) return res.status(404).json({ message: "partner not found" })

  const [referrals, commissions, payouts] = await Promise.all([
    svc.listPartnerReferrals({ partner_id: partner.id }, { take: 1000, order: { created_at: "DESC" } }),
    svc.listPartnerCommissions({ partner_id: partner.id }, { take: 5000, order: { created_at: "DESC" } }),
    svc.listPartnerPayouts({ partner_id: partner.id }, { take: 200, order: { created_at: "DESC" } }),
  ])

  const tenantIds = (referrals || []).map((r: any) => r.tenant_id)
  const tenants = tenantIds.length
    ? await svc.listTenants({ id: tenantIds }, { take: 1000 }).catch(() => [])
    : []
  const byId = new Map((tenants || []).map((t: any) => [t.id, t]))

  const pending = (commissions || []).filter((c: any) => c.status === "pending")
  const paid = (commissions || []).filter((c: any) => c.status === "paid")

  res.json({
    partner,
    referrals: (referrals || []).map((r: any) => {
      const t: any = byId.get(r.tenant_id)
      return {
        id: r.id,
        tenant_id: r.tenant_id,
        code_used: r.code_used,
        referred_at: r.created_at,
        store: t
          ? { name: t.name, slug: t.slug, status: t.status, package: t.package }
          : null,
      }
    }),
    commissions: (commissions || []).slice(0, 100),
    payouts: payouts || [],
    totals: {
      pending_cents: sum(pending),
      paid_cents: sum(paid),
      lifetime_cents: sum((commissions || []).filter((c: any) => c.status !== "void")),
    },
  })
}
