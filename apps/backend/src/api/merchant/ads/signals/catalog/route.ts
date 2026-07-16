import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../modules/marketing/platform-credentials"
import { syncTenantCatalog } from "../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/signals/catalog — sync this store's published products
 * into its Meta Commerce catalog (find-or-create). Idempotent by product id;
 * products without a photo or price are skipped and reported honestly.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const result = await syncTenantCatalog(mk, req.scope, ctx.tenant.id, {
      storeName: ctx.tenant.name ?? null,
    })
    res.json({ result })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Catalog sync failed" })
  }
}
