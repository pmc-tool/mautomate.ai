import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Load a post and assert tenant ownership. Fail-closed and null-safe: a missing
 * row OR a tenant_id not strictly equal to the caller's tenant (incl.
 * null/undefined) 404s and returns null.
 */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse,
  relations?: string[]
): Promise<any | null> => {
  const post = await (svc as any)
    .retrieveMarketingPost(id, relations ? { relations } : undefined)
    .catch(() => null)
  if (!post || post.tenant_id !== tenantId) {
    res.status(404).json({ message: `Post ${id} was not found` })
    return null
  }
  return post
}

/**
 * GET /merchant/marketing/posts/:id
 *
 * Retrieve a single post with its targets, media and revisions. Tenant-scoped.
 * Response: { post }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const post = await loadOwned(svc, id, tenantId, res, [
      "targets",
      "media",
      "revisions",
    ])
    if (!post) return
    res.json({ post })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve post",
    })
  }
}

/**
 * PUT /merchant/marketing/posts/:id
 *
 * Update a post's copy (tenant-scoped). Only provided fields change.
 * Body: { title?, body?, hashtags?, link_url?, status?, campaign_id?,
 *         brand_voice_id? }
 * Response: { post }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const data: Record<string, any> = {}
    if (b.title !== undefined) {
      data.title = typeof b.title === "string" ? b.title.trim() || null : null
    }
    if (b.body !== undefined) {
      data.body = typeof b.body === "string" ? b.body.trim() || null : null
    }
    if (b.hashtags !== undefined) {
      data.hashtags = Array.isArray(b.hashtags) ? b.hashtags : null
    }
    if (b.link_url !== undefined) {
      data.link_url =
        typeof b.link_url === "string" ? b.link_url.trim() || null : null
    }
    if (b.status !== undefined) data.status = b.status
    if (b.campaign_id !== undefined) {
      data.campaign_id =
        typeof b.campaign_id === "string" ? b.campaign_id : null
    }
    if (b.brand_voice_id !== undefined) {
      data.brand_voice_id =
        typeof b.brand_voice_id === "string" ? b.brand_voice_id : null
    }

    await (svc as any).updateMarketingPosts({ id, ...data })
    const post = await (svc as any).retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({ post })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to update post",
    })
  }
}

/**
 * DELETE /merchant/marketing/posts/:id
 *
 * Tenant-scoped hard delete. A marketing_post has hasMany children
 * (post_target / post_media / post_revision) whose FK points back at it; the
 * generated delete does NOT cascade, so deleting the parent while children
 * exist fails ("You tried to set relationship id ... but such entity does not
 * exist"). We therefore delete the child rows FIRST — each scoped to this
 * tenant and this post — then the post itself.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const collectIds = (rows: any): string[] =>
      (Array.isArray(rows) ? rows : [])
        .map((r: any) => r?.id)
        .filter(Boolean)

    // 1. Cascade children first (tenant + post scoped), in dependency order.
    const targetRows = await svc.listMarketingPostTargets({
      tenant_id: tenantId,
      post_id: id,
    })
    const targetIds = collectIds(targetRows)
    if (targetIds.length) {
      await svc.deleteMarketingPostTargets(targetIds)
    }

    const mediaRows = await (svc as any).listMarketingPostMedias({
      tenant_id: tenantId,
      post_id: id,
    })
    const mediaIds = collectIds(mediaRows)
    if (mediaIds.length) {
      await (svc as any).deleteMarketingPostMedias(mediaIds)
    }

    const revisionRows = await svc.listMarketingPostRevisions({
      tenant_id: tenantId,
      post_id: id,
    })
    const revisionIds = collectIds(revisionRows)
    if (revisionIds.length) {
      await svc.deleteMarketingPostRevisions(revisionIds)
    }

    // 2. Now the parent deletes cleanly.
    await (svc as any).deleteMarketingPosts(id)

    res.json({ id, object: "marketing_post", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete post",
    })
  }
}
