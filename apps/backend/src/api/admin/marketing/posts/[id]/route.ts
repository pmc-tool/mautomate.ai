import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { fromPostDto, toPostDetailDto } from "../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Fields that constitute post "content" — a change to any snapshots a revision. */
const CONTENT_FIELDS = ["title", "body", "hashtags", "link_url"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/posts/:id
 *
 * Retrieve a single post with its targets, media and revisions. Tenant-scoped.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const post = await svc.retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    if ((post as any).tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    res.json(
      toPostDetailDto(post, {
        targets: (post as any).targets ?? [],
        media: (post as any).media ?? [],
        revisions: (post as any).revisions ?? [],
      })
    )
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve post",
    })
  }
}

/**
 * POST /admin/marketing/posts/:id
 *
 * Update a post's copy. When any content field (title/body/hashtags/link_url)
 * changes, the PRIOR content is snapshotted into a new revision before the
 * update is applied, so edits are always recoverable.
 * Body: { title?, body?, hashtags?, link_url? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

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

    // Map the inbound UI vocabulary (content/link/hashtags-string) to columns.
    const data = fromPostDto(b)

    const contentChanged = CONTENT_FIELDS.some(
      (f) =>
        data[f] !== undefined &&
        JSON.stringify(data[f]) !== JSON.stringify((current as any)[f])
    )

    if (contentChanged) {
      const [, revCount] = await svc.listAndCountMarketingPostRevisions(
        { tenant_id: TENANT_ID, post_id: id },
        { take: 1 }
      )
      await svc.createMarketingPostRevisions({
        tenant_id: TENANT_ID,
        post_id: id,
        version: (revCount ?? 0) + 1,
        snapshot: {
          title: (current as any).title ?? null,
          body: (current as any).body ?? null,
          hashtags: (current as any).hashtags ?? null,
          link_url: (current as any).link_url ?? null,
        },
        created_by_user_id: (req as any).auth_context?.actor_id ?? null,
      })
    }

    await svc.updateMarketingPosts({ id, ...data } as any)

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
      message: e?.message ?? "Failed to update post",
    })
  }
}

/**
 * DELETE /admin/marketing/posts/:id
 *
 * Delete a post (tenant-scoped). Verifies ownership before deleting.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

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

    await svc.deleteMarketingPosts(id)

    res.json({ id, object: "marketing_post", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete post",
    })
  }
}
