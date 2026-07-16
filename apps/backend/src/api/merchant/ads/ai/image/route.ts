import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateAdImage } from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/ai/image — generate the ad image from a scene prompt
 * (the wizard passes the draft's image_prompt; the merchant can edit it) and
 * store it durably in the tenant's bucket.
 *
 * Credits: `ai_image_basic` per image. Nothing is charged on failure.
 *
 * Body: { prompt, orientation? ("square" | "landscape" | "portrait") }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  try {
    const prompt = String(b.prompt ?? "").trim()
    if (!prompt) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Describe the image the ad should show."
      )
    }

    const metered = await meterAction(
      req.scope,
      ctx.tenant.id,
      "ai_image_basic",
      1,
      async () => {
        const out = await generateAdImage(req.scope, ctx.tenant.id, {
          prompt,
          orientation: b.orientation,
        })
        return { result: out, actualUnits: 1 }
      }
    )
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (this needs ${creditsFor("ai_image_basic")}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({ ...metered.result, credits: creditsFor("ai_image_basic") })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Image generation failed" })
  }
}
