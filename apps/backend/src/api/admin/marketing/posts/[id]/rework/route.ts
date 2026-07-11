import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { getContentEngine } from "../../../_content"
import { toPostDetailDto } from "../../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/posts/:id/rework
 *
 * Rewrite an existing post's copy according to a free-text `instruction`
 * (e.g. "make it punchier", "add a call to action"). Returns the reworked post.
 * Body: { instruction }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as { instruction?: string }

  try {
    const instruction = b.instruction?.trim()
    if (!instruction) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An `instruction` is required to rework a post."
      )
    }

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
    const result = await engine.reworkPost(req.scope, {
      post_id: id,
      tenant_id: TENANT_ID,
      instruction,
    })

    if (!result?.post) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    // The UI expects a full PostDetail back — reload the post's relations.
    const reloaded = await svc.retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({
      ...toPostDetailDto(reloaded, {
        targets: (reloaded as any).targets ?? [],
        media: (reloaded as any).media ?? [],
        revisions: (reloaded as any).revisions ?? [],
      }),
      needs_ai: result?.needs_ai,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to rework post",
    })
  }
}
