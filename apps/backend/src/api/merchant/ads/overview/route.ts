import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { getAdsOverview } from "../../../../modules/marketing/ads"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

/**
 * GET /merchant/ads/overview?days=30
 *
 * The Advertising dashboard payload: cross-platform totals (spend,
 * impressions, clicks, conversions, ROAS), the per-campaign table, a daily
 * spend series, and connection/account status. Aggregated exclusively from
 * stored insight rows — empty tenants get zeros, never fabricated numbers.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const days = Number(req.query.days) || 30
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const overview = await getAdsOverview(mk, ctx.tenant.id, { days })
    res.json(overview)
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load the advertising overview" })
  }
}
