import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { getContentEngine } from "../../../_content"
import { toPostDetailDto, toRevisionDto } from "../../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/posts/:id/revisions
 *
 * List a post's revision history (newest first), tenant-scoped.
 * Response: { revisions, count }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const [revisions, count] =
      await svc.listAndCountMarketingPostRevisions(
        { tenant_id: TENANT_ID, post_id: id },
        { order: { version: "DESC" } }
      )

    res.json({ revisions: (revisions as any[]).map(toRevisionDto), count })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list revisions",
    })
  }
}

/**
 * POST /admin/marketing/posts/:id/revisions
 *
 * Restore the post's copy to a prior revision `version` via the content engine.
 * Body: { version }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as { version?: number }

  try {
    const version =
      typeof b.version === "number" ? b.version : parseInt(String(b.version))
    if (!Number.isFinite(version)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A numeric `version` is required to restore a revision."
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
    const post = await engine.restoreRevision(req.scope, {
      post_id: id,
      tenant_id: TENANT_ID,
      version,
    })

    if (!post) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    // The UI expects a full PostDetail back — reload the post's relations.
    const reloaded = await svc.retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json(
      toPostDetailDto(reloaded, {
        targets: (reloaded as any).targets ?? [],
        media: (reloaded as any).media ?? [],
        revisions: (reloaded as any).revisions ?? [],
      })
    )
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to restore revision",
    })
  }
}
