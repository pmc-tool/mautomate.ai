import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { resolveMerchant } from "../../../../_helpers"
import { adsStatusFor } from "../../../_helpers"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const ownRule = async (mk: any, tenantId: string, id: string) => {
  const rule = first(await mk.listAdsRules({ id, tenant_id: tenantId }))
  if (!rule) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Rule not found.")
  }
  return rule
}

/** POST /merchant/ads/autopilot/rules/:id — toggle. Body: { enabled } */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const rule = await ownRule(mk, ctx.tenant.id, req.params.id)
    await mk.updateAdsRules({
      id: rule.id,
      enabled: Boolean((req.body as any)?.enabled),
    } as any)
    res.json({ id: rule.id, enabled: Boolean((req.body as any)?.enabled) })
  } catch (e: any) {
    res.status(adsStatusFor(e)).json({ message: e?.message ?? "Failed" })
  }
}

/** DELETE /merchant/ads/autopilot/rules/:id */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const rule = await ownRule(mk, ctx.tenant.id, req.params.id)
    await mk.deleteAdsRules([rule.id])
    res.json({ id: rule.id, deleted: true })
  } catch (e: any) {
    res.status(adsStatusFor(e)).json({ message: e?.message ?? "Failed" })
  }
}
