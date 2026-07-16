import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { disconnectAdsConnection } from "../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * DELETE /merchant/ads/accounts/:id — disconnect an ad platform connection.
 *
 * Revokes locally: tokens are erased, the connection flips to `revoked`, its
 * ad accounts are disabled/deselected. Rows are kept so history and the audit
 * log stay intact; nothing can authenticate with the platform afterwards.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    await disconnectAdsConnection(mk, ctx.tenant.id, req.params.id)
    res.json({ id: req.params.id, disconnected: true })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to disconnect" })
  }
}
