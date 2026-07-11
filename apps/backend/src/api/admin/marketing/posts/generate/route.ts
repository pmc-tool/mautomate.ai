import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { getContentEngine } from "../../_content"
import { toPostDto, toTargetDto } from "../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/posts/generate
 *
 * One-shot: create a fresh draft post AND generate its copy in a single call.
 * A `prompt` is required. Any supplied `platforms` become pending targets so
 * the generated post can be scheduled/published afterwards.
 * Body: { prompt, product_ids?, platforms?, brand_voice_id?, tone?, length?,
 *         title?, campaign_id? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
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
      tenant_id: TENANT_ID,
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
          tenant_id: TENANT_ID,
          post_id: draftId,
          platform,
          status: "pending",
        })) as any
      )
    }

    const engine = getContentEngine()
    const result = await engine.generatePost(req.scope, {
      post_id: draftId,
      tenant_id: TENANT_ID,
      prompt,
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : undefined,
      platforms: platforms.length ? platforms : undefined,
      brand_voice_id: b.brand_voice_id,
      tone: b.tone,
      length: b.length,
      created_by_user_id: actorId,
    })

    const resultTargets = Array.isArray(result?.targets) ? result.targets : []

    res.status(201).json({
      post: toPostDto(result.post, resultTargets),
      targets: resultTargets.map(toTargetDto),
      needs_ai: result?.needs_ai,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate post",
    })
  }
}
