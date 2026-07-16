import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../../modules/marketing/platform-credentials"
import { setCampaignBudget } from "../../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../../_helpers"
import { adsStatusFor } from "../../../_helpers"

/**
 * POST /merchant/ads/campaigns/:id/budget — change the daily budget (MAJOR
 * currency units). Body: { daily_budget: number }.
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
    const campaign = await setCampaignBudget(
      mk,
      ctx.tenant.id,
      req.params.id,
      Number((req.body as any)?.daily_budget),
      "merchant"
    )
    res.json({
      campaign: {
        id: campaign.id,
        daily_budget: campaign.daily_budget,
        currency: campaign.currency,
      },
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Could not change the budget" })
  }
}
