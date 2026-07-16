import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"
import { runAdsSyncForTenant } from "../../../../modules/marketing/ads"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

/**
 * POST /merchant/ads/sync — refresh this tenant's advertising mirror now
 * (accounts, campaigns, insights) instead of waiting for the hourly sweep.
 * Returns an honest summary including any per-account errors.
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
    const summary = await runAdsSyncForTenant(mk, ctx.tenant.id)
    res.json({ summary })
  } catch (e: any) {
    res.status(adsStatusFor(e)).json({ message: e?.message ?? "Sync failed" })
  }
}
