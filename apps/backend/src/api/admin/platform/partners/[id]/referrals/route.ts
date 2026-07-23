import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"

/**
 * POST /admin/platform/partners/:id/referrals — manually attribute a store to
 * this partner (for referrals that arrived outside the ?ref link, or for
 * testing). Body: { tenant_id } or { slug }. A tenant can only ever be
 * referred once — attaching an already-referred tenant 409s.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<{ tenant_id?: string; slug?: string }>,
  res: MedusaResponse
) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partner = await svc.retrievePartner(req.params.id).catch(() => null)
  if (!partner) return res.status(404).json({ message: "partner not found" })

  const body = req.body ?? {}
  let tenant: any = null
  if (body.tenant_id) {
    tenant = await svc.retrieveTenant(body.tenant_id).catch(() => null)
  } else if (body.slug) {
    const [t] = await svc.listTenants({ slug: String(body.slug).trim() }, { take: 1 })
    tenant = t ?? null
  }
  if (!tenant) return res.status(404).json({ message: "store not found" })

  const [existing] = await svc.listPartnerReferrals(
    { tenant_id: tenant.id },
    { take: 1 }
  )
  if (existing) {
    return res.status(409).json({
      message: "this store is already attributed to a partner",
      partner_id: existing.partner_id,
    })
  }

  const [referral] = await svc.createPartnerReferrals([
    {
      partner_id: partner.id,
      tenant_id: tenant.id,
      code_used: null,
      meta: { attached_by: "operator" },
    },
  ])

  res.status(201).json({ referral })
}
