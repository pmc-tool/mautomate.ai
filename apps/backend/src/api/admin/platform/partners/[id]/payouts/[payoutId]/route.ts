import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../../modules/platform"

/**
 * PUT /admin/platform/partners/:id/payouts/:payoutId — settle a payout request.
 *
 * Body: { status: "paid" | "rejected", note? }
 *   paid     -> stamp paid_at; every commission bundled into this payout
 *               (payout_id match, still pending) flips to "paid".
 *   rejected -> commissions are released back to the open balance
 *               (payout_id cleared) so the partner can re-request.
 */
export const PUT = async (
  req: AuthenticatedMedusaRequest<{ status?: string; note?: string }>,
  res: MedusaResponse
) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partner = await svc.retrievePartner(req.params.id).catch(() => null)
  if (!partner) return res.status(404).json({ message: "partner not found" })

  const payout = await svc.retrievePartnerPayout(req.params.payoutId).catch(() => null)
  if (!payout || payout.partner_id !== partner.id) {
    return res.status(404).json({ message: "payout not found" })
  }
  if (payout.status !== "requested") {
    return res.status(400).json({ message: `payout is already ${payout.status}` })
  }

  const status = String(req.body?.status ?? "")
  if (!["paid", "rejected"].includes(status)) {
    return res.status(400).json({ message: "status must be \"paid\" or \"rejected\"" })
  }
  const note = typeof req.body?.note === "string" ? req.body.note : null

  const bundled = await svc.listPartnerCommissions(
    { payout_id: payout.id, status: "pending" },
    { take: 5000 }
  )

  if (status === "paid") {
    await svc.updatePartnerPayouts({
      id: payout.id,
      status: "paid",
      note,
      paid_at: new Date(),
    })
    if (bundled?.length) {
      await svc.updatePartnerCommissions(
        bundled.map((c: any) => ({ id: c.id, status: "paid" }))
      )
    }
  } else {
    await svc.updatePartnerPayouts({ id: payout.id, status: "rejected", note })
    if (bundled?.length) {
      await svc.updatePartnerCommissions(
        bundled.map((c: any) => ({ id: c.id, payout_id: null }))
      )
    }
  }

  const updated = await svc.retrievePartnerPayout(payout.id)
  res.json({ payout: updated, commissions_updated: bundled?.length ?? 0 })
}
