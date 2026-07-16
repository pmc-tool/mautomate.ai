import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateAdImage } from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/ai/image — generate the ad image and store it durably.
 *
 * Two engines, honestly priced:
 *  - `product_image_url` present -> PRODUCT-ANCHORED scene (the Gemini
 *    subject-consistent engine): the merchant's REAL product placed in the
 *    scene — an ad must never show a product the store doesn't sell.
 *    Bills `ai_image`.
 *  - no product photo (whole-store ads) -> text-to-image. Bills
 *    `ai_image_basic`.
 *
 * Nothing is charged on failure.
 *
 * Body: { prompt, product_image_url?, orientation? }
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
    const productImageUrl =
      typeof b.product_image_url === "string" &&
      b.product_image_url.startsWith("http")
        ? b.product_image_url
        : null
    const action = productImageUrl ? "ai_image" : "ai_image_basic"

    const metered = await meterAction(
      req.scope,
      ctx.tenant.id,
      action,
      1,
      async () => {
        const out = await generateAdImage(req.scope, ctx.tenant.id, {
          prompt,
          product_image_url: productImageUrl,
          orientation: b.orientation,
        })
        return { result: out, actualUnits: 1 }
      }
    )
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (this needs ${creditsFor(action)}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({ ...metered.result, credits: creditsFor(action) })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Image generation failed" })
  }
}
