import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../../modules/cms"
import type CmsModuleService from "../../../../../modules/cms/service"
import { resolveMerchant } from "../../../_helpers"
import {
  BLOG_POST_RELATIONS,
  estimateReadingTime,
  loadPost,
  recordMerchantBlogAudit,
  resolveUniqueSlug,
} from "../../_helpers"

/**
 * GET /merchant/blog/posts/:id
 * Full post + author + categories + translations. Ownership is fail-closed —
 * a post id from another store 404s. Response: { post }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const post = await loadPost(service, req.params.id, ctx.tenant.id)
  res.json({ post })
}

type UpdateBody = {
  title?: string
  slug?: string
  excerpt?: string | null
  content?: string | null
  cover_image?: string | null
  status?: "draft" | "published"
  published_at?: string | null
  scheduled_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
  reading_time?: number | null
  author_id?: string | null
  category_ids?: string[]
}

const POST_SCALAR_FIELDS = [
  "title",
  "slug",
  "excerpt",
  "content",
  "cover_image",
  "status",
  "seo_title",
  "seo_description",
  "og_image",
  "reading_time",
] as const

/**
 * PUT /merchant/blog/posts/:id
 * Update post draft fields, author, and/or categories (replace set via
 * `category_ids`). Slug uniqueness is re-checked per-store. Publishing state
 * transitions go through /posts/:id/publish — that endpoint also revalidates
 * the storefront; a plain status edit here does not.
 *
 * Response: { post }
 */
const update = async (
  req: MedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}
  const tenantId = ctx.tenant.id as string

  const before = await loadPost(service, id, tenantId)

  // Slug uniqueness pre-check (exclude self).
  if (body.slug && body.slug !== before.slug) {
    await resolveUniqueSlug(
      (f) => service.listCmsBlogPosts(f),
      body.slug,
      before.title,
      id,
      tenantId
    )
  }

  const patch: Record<string, unknown> = { id }
  for (const field of POST_SCALAR_FIELDS) {
    if (field in body) {
      patch[field] = (body as Record<string, unknown>)[field]
    }
  }

  // Re-estimate reading time when content changed and no explicit value given.
  if ("content" in body && !("reading_time" in body)) {
    patch.reading_time = estimateReadingTime(body.content ?? null)
  }

  // Date columns: accept ISO strings or null.
  if ("published_at" in body) {
    patch.published_at = body.published_at ? new Date(body.published_at) : null
  }
  if ("scheduled_at" in body) {
    patch.scheduled_at = body.scheduled_at ? new Date(body.scheduled_at) : null
  }

  // belongsTo author FK (nullable).
  if ("author_id" in body) {
    patch.author_id = body.author_id ?? null
  }

  // manyToMany categories: passing the array of IDs replaces the linked set.
  if (Array.isArray(body.category_ids)) {
    patch.categories = body.category_ids
  }

  if (Object.keys(patch).length > 1) {
    await service.updateCmsBlogPosts(patch)
  }

  const post = await service.retrieveCmsBlogPost(id, {
    relations: [...BLOG_POST_RELATIONS],
  })

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_post.update",
    "blog_post",
    id,
    { before, after: post }
  )

  res.json({ post })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /merchant/blog/posts/:id
 * Soft-delete the post (cascades to translation rows; category links detach).
 * Response: { id, object: "blog_post", deleted: true }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const before = await loadPost(service, id, ctx.tenant.id)

  await service.softDeleteCmsBlogPosts(id)

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_post.delete",
    "blog_post",
    id,
    { before }
  )

  res.json({ id, object: "blog_post", deleted: true })
}
