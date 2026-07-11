import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../../modules/cms"
import { cmsTenantId } from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import {
  BLOG_LIST_RELATIONS,
  resolveStoreLocale,
  shapePostCard,
} from "../_helpers"

/**
 * GET /store/cms/blog/posts
 *
 * Public (reachable with the publishable key). Lists PUBLISHED blog posts only,
 * newest first, paginated, resolved to the requested locale (header
 * `x-medusa-locale` / `?lang=`). Cards carry author + categories + cover +
 * excerpt + published_at.
 *
 * Query:
 *   category? — filter by a linked category SLUG
 *   limit     — page size (default 12, max 50)
 *   offset    — page offset (default 0)
 *
 * Cache tag (storefront fetcher): `cms-blog`. A blog publish/unpublish emits
 * `cms.published` (entity_type "blog_post"), and the subscriber invalidates
 * `cms-blog`, so this listing rebuilds on the next request.
 *
 * Response: { posts, count, limit, offset, locale }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const locale = resolveStoreLocale(req)

  const category = (req.query.category as string | undefined)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 12) || 12, 50)
  const offset = Number(req.query.offset ?? 0) || 0

  // Pooled multi-tenant: resolve the store. Fail-closed — an unresolved tenant
  // returns an empty listing rather than another store's posts.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ posts: [], count: 0, limit, offset, locale })
    return
  }

  // PUBLISHED only — drafts/scheduled posts are never exposed on the store.
  const filters: Record<string, unknown> = {
    tenant_id: tenantId,
    status: "published",
  }
  if (category) {
    // manyToMany relation filter (same pattern as the admin `category_id` filter).
    filters.categories = { slug: category }
  }

  const [posts, count] = await service.listAndCountCmsBlogPosts(filters, {
    take: limit,
    skip: offset,
    order: { published_at: "DESC" },
    relations: [...BLOG_LIST_RELATIONS],
  })

  res.json({
    posts: (posts ?? []).map((p) => shapePostCard(p, locale)),
    count,
    limit,
    offset,
    locale,
  })
}
