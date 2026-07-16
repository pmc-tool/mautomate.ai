import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../../modules/marketing/platform-credentials"
import { setCampaignStatus } from "../../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../../_helpers"
import { adsStatusFor } from "../../../_helpers"

/**
 * POST /merchant/ads/campaigns/:id/status — the explicit go-live / pause
 * action. Body: { status: "active" | "paused" }.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const status = (req.body as any)?.status
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    if (status !== "active" && status !== "paused") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '`status` must be "active" or "paused".'
      )
    }
    const campaign = await setCampaignStatus(
      mk,
      ctx.tenant.id,
      req.params.id,
      status,
      "merchant"
    )
    res.json({
      campaign: {
        id: campaign.id,
        status: campaign.status,
        external_status: campaign.external_status,
      },
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Could not change the campaign status" })
  }
}
