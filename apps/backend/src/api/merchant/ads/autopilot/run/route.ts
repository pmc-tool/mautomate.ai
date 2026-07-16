import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { runAutopilotForTenant } from "../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/autopilot/run — run the autopilot check for this store
 * right now (free; the daily charge applies only to the scheduled sweep).
 * Returns the honest summary of everything it did and why.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const summary = await runAutopilotForTenant(mk, req.scope, ctx.tenant.id, {
      manual: true,
    })
    res.json({ summary })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Autopilot check failed" })
  }
}
