import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateAdImage } from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"
import { assertPublicHttpUrl } from "../../../../../lib/ssrf-guard"

/**
 * POST /merchant/ads/ai/image — generate the ad image and store it durably.
 *
 * ALWAYS product-anchored (the Gemini subject-consistent engine): the
 * merchant's REAL photo placed into the scene. Text-to-image is deliberately
 * not offered — an invented product is never an acceptable ad. Bills
 * `ai_image`; nothing is charged on failure.
 *
 * Body: { prompt, product_image_url (required), orientation? }
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
    if (!productImageUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Ad images are always built from one of your real product photos — pick the photo the ad should be built on."
      )
    }
    // SECURITY INVARIANT (SSRF): this URL is fetched server-side (Gemini inline
    // part), so it must resolve to a PUBLIC host — never loopback/metadata/
    // private IPs. Validated by the shared ssrf-guard before any fetch.
    await assertPublicHttpUrl(productImageUrl)
    const action = "ai_image"

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
