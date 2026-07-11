import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { getContentEngine } from "../../../_content"
import { toPostDto, toTargetDto } from "../../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/posts/:id/generate
 *
 * (Re)generate the copy for an existing post via the AI content engine. The
 * engine writes the generated body/hashtags back onto the post and returns it.
 * Body: { prompt?, product_ids?, platforms?, brand_voice_id?, tone?, length? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    prompt?: string
    product_ids?: string[]
    platforms?: string[]
    brand_voice_id?: string
    tone?: string
    length?: string
  }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingPost(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const engine = getContentEngine()
    const result = await engine.generatePost(req.scope, {
      post_id: id,
      tenant_id: TENANT_ID,
      prompt: b.prompt,
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : undefined,
      platforms: Array.isArray(b.platforms) ? b.platforms : undefined,
      brand_voice_id: b.brand_voice_id,
      tone: b.tone,
      length: b.length,
      created_by_user_id: (req as any).auth_context?.actor_id ?? null,
    })

    const resultTargets = Array.isArray(result?.targets) ? result.targets : []

    res.json({
      post: toPostDto(result.post, resultTargets),
      targets: resultTargets.map(toTargetDto),
      needs_ai: result?.needs_ai,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to generate post",
    })
  }
}
