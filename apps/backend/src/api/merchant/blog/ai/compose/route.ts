import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getAiTextProvider } from "../../../../../modules/marketing/ai/registry"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { extractJson } from "../_helpers"

const TONES = ["friendly", "professional", "playful", "luxury"] as const
const LENGTHS: Record<string, string> = {
  short: "around 250 words",
  medium: "around 500 words",
  long: "around 900 words",
}

/**
 * POST /merchant/blog/ai/compose — draft a complete blog post with AI.
 *
 * Body: { brief (what the post is about), tone?, length? }
 * Bills `ai_text`; nothing is charged when generation fails.
 * Response: { draft: { title, excerpt, content_html, seo_title,
 *             seo_description }, credits }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  try {
    const brief = String(b.brief ?? "").trim().slice(0, 1000)
    if (!brief) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Describe what the post should be about."
      )
    }
    const tone = TONES.includes(b.tone) ? b.tone : "friendly"
    const length = LENGTHS[String(b.length)] ?? LENGTHS.medium

    const provider = getAiTextProvider(ctx.tenant.id)
    if (!provider || !provider.isConfigured()) {
      return res.status(503).json({ message: "AI writing is not configured yet." })
    }

    const storeName = ctx.tenant.name || "our store"
    const system =
      `You are the content writer for "${storeName}", an online store. ` +
      `You write engaging, well-structured blog posts that read naturally and ` +
      `help shoppers, never sounding like an ad. Respond ONLY with a JSON object.`
    const prompt =
      `Write a blog post for the store's blog.\n` +
      `Topic / brief: ${brief}\n` +
      `Tone: ${tone}. Length: ${length}.\n\n` +
      `Return STRICT JSON with exactly these keys:\n` +
      `{\n` +
      `  "title": "post title, plain text, no quotes around it",\n` +
      `  "excerpt": "1-2 sentence summary for the blog listing",\n` +
      `  "content_html": "the post body as clean HTML using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags",\n` +
      `  "seo_title": "max 60 chars",\n` +
      `  "seo_description": "max 155 chars"\n` +
      `}`

    const action = "ai_text"
    const metered = await meterAction(req.scope, ctx.tenant.id, action, 1, async () => {
      const text = await provider.generate(prompt, {
        system,
        json: true,
        maxTokens: 3000,
        temperature: 0.7,
        feature: "blog-compose",
      })
      const parsed = extractJson(text)
      const draft = {
        title: String(parsed.title ?? "").trim(),
        excerpt: String(parsed.excerpt ?? "").trim(),
        content_html: String(parsed.content_html ?? "").trim(),
        seo_title: String(parsed.seo_title ?? "").trim(),
        seo_description: String(parsed.seo_description ?? "").trim(),
      }
      if (!draft.title || !draft.content_html) {
        throw new Error("The AI draft came back incomplete — try again.")
      }
      return { result: draft, actualUnits: 1 }
    })
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (this needs ${creditsFor(action)}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({ draft: metered.result, credits: creditsFor(action) })
  } catch (e: any) {
    const code = e instanceof MedusaError ? 400 : 500
    res.status(code).json({ message: e?.message ?? "Drafting failed" })
  }
}
