import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  promptToVideo,
  type Orientation,
} from "../../../../../modules/marketing/ai/video-generator"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { fetchBytes, storeBytes } from "../_helpers"

const ORIENTATIONS: Orientation[] = ["landscape", "portrait", "square"]

/**
 * POST /merchant/blog/ai/video — generate a short motion clip for a blog post
 * (prompt -> still -> SVD-XT animation, ~4s mp4) and store the clip AND its
 * poster frame durably. Takes a few minutes. Bills `ai_video`; nothing is
 * charged when generation fails.
 *
 * Body: { prompt, orientation? }
 * Response: { video_url, poster_url, credits }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  try {
    const prompt = String(b.prompt ?? "").trim().slice(0, 500)
    if (!prompt) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Describe the clip you want."
      )
    }
    const key = process.env.NOVITA_API_KEY
    if (!key) {
      return res.status(503).json({ message: "Video generation is not configured." })
    }
    const orientation: Orientation = ORIENTATIONS.includes(b.orientation)
      ? b.orientation
      : "landscape"

    const action = "ai_video"
    const metered = await meterAction(req.scope, ctx.tenant.id, action, 1, async () => {
      const out = await promptToVideo(key, prompt, orientation)
      const [videoBytes, posterBytes] = await Promise.all([
        fetchBytes(out.video),
        fetchBytes(out.poster),
      ])
      const [video_url, poster_url] = await Promise.all([
        storeBytes(req.scope, ctx.tenant.id, "blog-ai-video", videoBytes, "video/mp4"),
        storeBytes(req.scope, ctx.tenant.id, "blog-ai-poster", posterBytes, "image/png"),
      ])
      return { result: { video_url, poster_url }, actualUnits: 1 }
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
    res.status(code).json({ message: e?.message ?? "Video generation failed" })
  }
}
