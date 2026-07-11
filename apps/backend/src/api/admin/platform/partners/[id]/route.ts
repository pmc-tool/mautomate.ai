import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"

/** PUT /admin/platform/partners/:id — edit tier/commission/status. */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const p = await svc.retrievePartner(req.params.id).catch(() => null)
  if (!p) return res.status(404).json({ message: "partner not found" })
  const b = (req.body ?? {}) as any
  const patch: any = { id: req.params.id }
  if (b.tier && ["bronze", "silver", "gold"].includes(b.tier)) patch.tier = b.tier
  if (b.status && ["active", "inactive"].includes(b.status)) patch.status = b.status
  if (Number.isFinite(+b.commission_pct)) patch.commission_pct = +b.commission_pct
  if (typeof b.company === "string") patch.company = b.company
  if (typeof b.email === "string") patch.email = b.email
  await svc.updatePartners(patch)
  res.json({ id: req.params.id, ...patch })
}

/** DELETE /admin/platform/partners/:id */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  await svc.deletePartners(req.params.id)
  res.json({ id: req.params.id, deleted: true })
}
