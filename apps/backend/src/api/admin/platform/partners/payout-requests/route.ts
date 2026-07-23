import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"

/**
 * GET /admin/platform/partners/payout-requests — every OPEN payout request
 * across all partners, newest first, with the partner's name/email attached.
 * This is the operator's work queue: anything here is waiting to be paid or
 * rejected (via PUT /partners/:id/payouts/:payoutId).
 *
 * Response: { requests: [{ id, partner_id, partner_name, partner_email,
 *   amount_cents, method, created_at }], count }
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)

  const payouts = await svc.listPartnerPayouts(
    { status: "requested" },
    { take: 500, order: { created_at: "ASC" } }
  )

  const partnerIds = Array.from(
    new Set((payouts || []).map((p: any) => p.partner_id))
  )
  const partners = partnerIds.length
    ? await svc.listPartners({ id: partnerIds }, { take: 500 }).catch(() => [])
    : []
  const byId = new Map((partners || []).map((p: any) => [p.id, p]))

  res.json({
    requests: (payouts || []).map((p: any) => {
      const partner: any = byId.get(p.partner_id)
      return {
        id: p.id,
        partner_id: p.partner_id,
        partner_name: partner?.name ?? p.partner_id,
        partner_email: partner?.email ?? null,
        amount_cents: p.amount_cents,
        method: p.method,
        created_at: p.created_at,
      }
    }),
    count: (payouts || []).length,
  })
}
