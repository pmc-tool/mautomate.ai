import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateAdVideo } from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/ai/video — animate the ad image into a ~4s video clip
 * (the same SVD-XT engine behind the CMS studio) and store it durably. The
 * request awaits the render (typically 30-90s); the wizard shows the honest
 * long-running stage while this resolves.
 *
 * Credits: `ai_video` per clip. Nothing is charged on failure.
 *
 * Body: { image_url, orientation?, motion? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  try {
    const imageUrl = String(b.image_url ?? "").trim()
    if (!imageUrl.startsWith("http")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Generate or pick the ad image first — the video animates it."
      )
    }

    const metered = await meterAction(
      req.scope,
      ctx.tenant.id,
      "ai_video",
      1,
      async () => {
        const out = await generateAdVideo(req.scope, ctx.tenant.id, {
          image_url: imageUrl,
          orientation: b.orientation,
          motion: Number(b.motion) || undefined,
        })
        return { result: out, actualUnits: 1 }
      }
    )
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (a video needs ${creditsFor("ai_video")}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({ ...metered.result, credits: creditsFor("ai_video") })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Video generation failed" })
  }
}
