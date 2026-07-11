import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { cmsTenantId } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import {
  BLOG_DETAIL_RELATIONS,
  BLOG_LIST_RELATIONS,
  resolveStoreLocale,
  shapePostCard,
  shapePostDetail,
} from "../../_helpers"

const RELATED_LIMIT = 3

/**
 * GET /store/cms/blog/posts/:slug
 *
 * Public (reachable with the publishable key). Serves a single PUBLISHED post by
 * slug, resolved to the requested locale (header `x-medusa-locale` / `?lang=`),
 * with full content, author (incl. bio), categories, a resolved `seo` block, and
 * up to 3 related published posts (sharing a category, newest first; topped up
 * with other recent posts when sparse).
 *
 * 404 for a missing OR unpublished post (drafts/scheduled never leak).
 *
 * Cache tags (storefront fetcher): `cms-blog-post-<slug>` + `cms-blog`. A publish/
 * unpublish of THIS post emits `cms.published` (entity_type "blog_post", slug),
 * and the subscriber invalidates both tags, so the detail rebuilds (or 404s once
 * unpublished) on the next request.
 *
 * Response: { post, related, locale }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const locale = resolveStoreLocale(req)
  const slug = req.params.slug

  // Pooled multi-tenant: resolve the store. Fail-closed — an unresolved tenant
  // 404s rather than serving another store's post.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No published blog post found for slug "${slug}".`
    )
  }

  const [post] = await service.listCmsBlogPosts(
    { tenant_id: tenantId, slug, status: "published" },
    { take: 1, relations: [...BLOG_DETAIL_RELATIONS] }
  )

  if (!post) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No published blog post found for slug "${slug}".`
    )
  }

  const related = await loadRelated(service, tenantId, post, locale)

  res.json({
    post: shapePostDetail(post, locale),
    related,
    locale,
  })
}

/**
 * Fetch up to {@link RELATED_LIMIT} related published posts: prefer posts that
 * share a category with `post`, newest first, excluding the post itself. When
 * that yields fewer than the limit, top up with other recent published posts so
 * the "Related" rail is never empty on the storefront.
 */
async function loadRelated(
  service: CmsModuleService,
  tenantId: string,
  post: Record<string, any>,
  locale: ReturnType<typeof resolveStoreLocale>
) {
  const categoryIds: string[] = (post.categories ?? [])
    .map((c: Record<string, any>) => c.id)
    .filter(Boolean)

  const picked = new Map<string, Record<string, any>>()

  if (categoryIds.length) {
    const byCategory = await service.listCmsBlogPosts(
      { tenant_id: tenantId, status: "published", categories: { id: categoryIds } },
      {
        take: RELATED_LIMIT + 1,
        order: { published_at: "DESC" },
        relations: [...BLOG_LIST_RELATIONS],
      }
    )
    for (const row of byCategory ?? []) {
      if (row.id !== post.id) picked.set(row.id, row)
    }
  }

  if (picked.size < RELATED_LIMIT) {
    const recent = await service.listCmsBlogPosts(
      { tenant_id: tenantId, status: "published" },
      {
        take: RELATED_LIMIT + 1,
        order: { published_at: "DESC" },
        relations: [...BLOG_LIST_RELATIONS],
      }
    )
    for (const row of recent ?? []) {
      if (row.id !== post.id) picked.set(row.id, row)
    }
  }

  return [...picked.values()]
    .slice(0, RELATED_LIMIT)
    .map((p) => shapePostCard(p, locale))
}
