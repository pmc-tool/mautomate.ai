import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePartner } from "../_helpers"

/**
 * GET /partner/referrals — the stores this partner referred, with safe tenant
 * facts only (name/slug/status/package/created). Response: { referrals }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx

  const referrals = await svc.listPartnerReferrals(
    { partner_id: partner.id },
    { take: 1000, order: { created_at: "DESC" } }
  )

  const tenantIds = (referrals || []).map((r: any) => r.tenant_id)
  const tenants = tenantIds.length
    ? await svc.listTenants({ id: tenantIds }, { take: 1000 }).catch(() => [])
    : []
  const byId = new Map((tenants || []).map((t: any) => [t.id, t]))

  res.json({
    referrals: (referrals || []).map((r: any) => {
      const t: any = byId.get(r.tenant_id)
      return {
        id: r.id,
        tenant_id: r.tenant_id,
        code_used: r.code_used,
        referred_at: r.created_at,
        store: t
          ? {
              name: t.name,
              slug: t.slug,
              status: t.status,
              package: t.package,
              created_at: t.created_at,
            }
          : null,
      }
    }),
  })
}
