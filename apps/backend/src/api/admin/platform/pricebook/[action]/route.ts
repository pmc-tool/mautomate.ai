import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"
import { setRateOverride } from "../../../../../modules/platform/pricing/price-book"

/** PUT /admin/platform/pricebook/:action — retune a credit price. */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [e] = await svc.listPriceBookEntries({ action: req.params.action }, { take: 1 })
  if (!e) return res.status(404).json({ message: "action not found" })
  const b = (req.body ?? {}) as any
  const patch: any = { id: e.id }
  if (b.credits !== undefined) patch.credits = Number(b.credits)
  if (b.vendor_cost_usd !== undefined) patch.vendor_cost_usd = Number(b.vendor_cost_usd)
  await svc.updatePriceBookEntries([patch])
  if (patch.credits !== undefined) setRateOverride(req.params.action, patch.credits)
  res.json({ ...e, ...patch })
}
