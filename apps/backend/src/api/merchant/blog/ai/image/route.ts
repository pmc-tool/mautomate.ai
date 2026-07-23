import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  promptToImage,
  type Orientation,
} from "../../../../../modules/marketing/ai/video-generator"
import { generateAdImage } from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { fetchBytes, storeBytes } from "../_helpers"
import { assertPublicHttpUrl } from "../../../../../lib/ssrf-guard"

const ORIENTATIONS: Orientation[] = ["landscape", "portrait", "square"]

/**
 * Build ONE coherent image prompt from everything we know, so the cover can
 * never fight the article: the post title (and excerpt) lead, the merchant's
 * extra direction refines, and a strict "clean blog cover" style block closes
 * (no text/logos — titles belong to the page, not baked into the image).
 */
function buildCoverPrompt(input: {
  prompt?: string
  title?: string
  excerpt?: string
  productAnchored: boolean
}): string {
  const parts: string[] = []
  if (input.title) {
    parts.push(
      `A clean editorial blog cover image for an article titled "${input.title}".`
    )
  }
  if (input.excerpt) {
    parts.push(`The article is about: ${input.excerpt}`)
  }
  if (input.prompt) {
    parts.push(input.prompt)
  }
  if (input.productAnchored) {
    parts.push(
      "Feature the product from the photo naturally as the hero of a lifestyle scene that matches the article's theme."
    )
  }
  parts.push(
    "Clean premium blog-cover aesthetic: one cohesive soft background, natural light, generous negative space, absolutely no text, no lettering, no logos, no watermarks."
  )
  return parts.join(" ")
}

/**
 * POST /merchant/blog/ai/image — generate a blog image and store it durably.
 *
 * Two engines, one endpoint:
 *   - `product_image_url` given -> PRODUCT-ANCHORED: the merchant's REAL
 *     product photo is placed into a new scene (the same subject-consistent
 *     engine the ads use), so a blog post about a product shows the actual
 *     product.
 *   - otherwise -> text-to-image (Novita SDXL).
 *
 * `context` ({ title, excerpt }) makes the image match the article — callers
 * should always send it for covers. Bills `ai_image`; nothing on failure.
 *
 * Body: { prompt?, product_image_url?, context?, orientation? }
 * Response: { url, engine, credits }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  try {
    const prompt = String(b.prompt ?? "").trim().slice(0, 500)
    const title = String(b.context?.title ?? "").trim().slice(0, 200)
    const excerpt = String(b.context?.excerpt ?? "").trim().slice(0, 300)
    const productImageUrl =
      typeof b.product_image_url === "string" &&
      b.product_image_url.startsWith("http")
        ? b.product_image_url
        : null

    // SECURITY INVARIANT (SSRF): a product image URL is fetched server-side
    // (product-anchored engine), so it must resolve to a PUBLIC host — reject
    // loopback/metadata/private IPs before any fetch.
    if (productImageUrl) {
      await assertPublicHttpUrl(productImageUrl)
    }

    if (!prompt && !title && !productImageUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Describe the image, give the post a title first, or pick a product."
      )
    }
    const orientation: Orientation = ORIENTATIONS.includes(b.orientation)
      ? b.orientation
      : "landscape"

    const fullPrompt = buildCoverPrompt({
      prompt,
      title,
      excerpt,
      productAnchored: !!productImageUrl,
    })

    const action = "ai_image"
    const metered = await meterAction(req.scope, ctx.tenant.id, action, 1, async () => {
      if (productImageUrl) {
        // Product-anchored scene (stores durably itself).
        const out = await generateAdImage(req.scope, ctx.tenant.id, {
          prompt: fullPrompt,
          product_image_url: productImageUrl,
          orientation,
        })
        return {
          result: { url: out.image_url, engine: "product_scene" },
          actualUnits: 1,
        }
      }
      const key = process.env.NOVITA_API_KEY
      if (!key) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Image generation is not configured."
        )
      }
      const vendorUrl = await promptToImage(key, fullPrompt, orientation)
      const bytes = await fetchBytes(vendorUrl)
      const url = await storeBytes(
        req.scope,
        ctx.tenant.id,
        "blog-ai-image",
        bytes,
        "image/png"
      )
      return { result: { url, engine: "text_to_image" }, actualUnits: 1 }
    })
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (this needs ${creditsFor(action)}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({ ...metered.result, credits: creditsFor(action) })
  } catch (e: any) {
    const code = e instanceof MedusaError ? 400 : 500
    res.status(code).json({ message: e?.message ?? "Image generation failed" })
  }
}
