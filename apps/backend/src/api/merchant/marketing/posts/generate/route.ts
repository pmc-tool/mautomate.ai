import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { generatePost } from "../../../../../modules/marketing/content/content-service"
import { resolveMerchant } from "../../../_helpers"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"

/**
 * POST /merchant/marketing/posts/generate
 *
 * One-shot: create a fresh draft post AND generate its copy via the AI content
 * engine, in a single tenant-scoped call. A `prompt` is required. Any supplied
 * `platforms` become pending targets so the post can be scheduled/published.
 *
 * Body: { prompt, product_ids?, platforms?, brand_voice_id?, tone?, length?,
 *         title?, campaign_id? }
 *
 * When no AI provider is configured the draft is still created and `needs_ai`
 * is true (honest empty copy rather than a fabricated caption).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as {
    prompt?: string
    product_ids?: string[]
    platforms?: string[]
    brand_voice_id?: string
    tone?: string
    length?: string
    title?: string
    campaign_id?: string
  }

  try {
    const prompt = b.prompt?.trim()
    if (!prompt) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `prompt` is required to generate a post."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const actorId = (req as any).auth_context?.actor_id ?? null

    const created = await svc.createMarketingPosts({
      tenant_id: tenantId,
      status: "draft",
      source: "manual",
      title: b.title?.trim() ?? null,
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : null,
      campaign_id: b.campaign_id ?? null,
      brand_voice_id: b.brand_voice_id ?? null,
      created_by_user_id: actorId,
    } as any)

    const draft = Array.isArray(created) ? created[0] : created
    const draftId = (draft as any).id

    const platforms = Array.isArray(b.platforms) ? b.platforms : []
    if (platforms.length) {
      await svc.createMarketingPostTargets(
        platforms.map((platform) => ({
          tenant_id: tenantId,
          post_id: draftId,
          platform,
          status: "pending",
        })) as any
      )
    }

    const metered = await meterAction(req.scope, tenantId, "ai_text", 1, async () => {
      const r = await generatePost(req.scope, {
        postId: draftId,
        tenantId,
        prompt,
        productIds: Array.isArray(b.product_ids) ? b.product_ids : undefined,
        platforms: platforms.length ? platforms : undefined,
        brandVoiceId: b.brand_voice_id,
        tone: b.tone,
        length: b.length,
        userId: actorId ?? undefined,
      } as any)
      return { result: r, actualUnits: (r as any)?.needs_ai ? 0 : 1 }
    })
    if (!metered.ok) {
      return res.status(402).json({
        message:
          "You're out of AI credits. Top up in Billing to generate content.",
        code: "insufficient_credits",
      })
    }
    const result = metered.result

    const reloaded = await (svc as any).retrieveMarketingPost(draftId, {
      relations: ["targets", "media", "revisions"],
    })

    res.status(201).json({
      post: reloaded,
      needs_ai: (result as any)?.needs_ai,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate post",
    })
  }
}
