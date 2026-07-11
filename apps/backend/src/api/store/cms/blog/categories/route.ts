import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../../modules/cms"
import { cmsTenantId } from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"

/**
 * GET /store/cms/blog/categories
 *
 * Public (reachable with the publishable key). Lists all blog categories with a
 * `post_count` of PUBLISHED posts each (so the storefront can render a sidebar /
 * filter with counts and hide empty terms if it wants).
 *
 * `post_count` is resolved per category via `listAndCount` (the total is computed
 * by a COUNT query independent of `take`, so it is exact). Counts are
 * locale-invariant, so this endpoint shares the `cms-blog` cache tag and rebuilds
 * whenever a post is published/unpublished.
 *
 * Response: { categories, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: resolve the store. Fail-closed — an unresolved tenant
  // returns no categories rather than another store's taxonomy.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ categories: [], count: 0 })
    return
  }

  const [categories, count] = await service.listAndCountCmsBlogCategories(
    { tenant_id: tenantId },
    { order: { name: "ASC" } }
  )

  const shaped = await Promise.all(
    (categories ?? []).map(async (c: any) => {
      // `take: 1` keeps the row payload tiny; the COUNT is exact regardless.
      const [, post_count] = await service.listAndCountCmsBlogPosts(
        { tenant_id: tenantId, status: "published", categories: { id: c.id } },
        { take: 1 }
      )
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        post_count,
      }
    })
  )

  res.json({ categories: shaped, count })
}
