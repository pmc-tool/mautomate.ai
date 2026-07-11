import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import { assertLocale } from "../../../pages/_helpers"
import {
  BLOG_POST_RELATIONS,
  estimateReadingTime,
  loadPost,
  recordBlogAudit,
  resolveUniqueSlug,
} from "../../_helpers"

/**
 * GET /admin/cms/blog/posts/:id
 * Full post + author + categories + translations. Response: { post }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const post = await loadPost(service, req.params.id, tenantId)
  res.json({ post })
}

type PostTranslationInput = {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
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
  // Per-locale overrides: { bn: { title?, excerpt?, content?, seo_*? } }.
  translations?: Record<string, PostTranslationInput>
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
 * Upsert non-default-locale translation rows for a post. The default locale (en)
 * lives on the post row itself and is rejected here.
 */
async function upsertPostTranslations(
  service: CmsModuleService,
  postId: string,
  translations: Record<string, PostTranslationInput>
) {
  for (const [rawLocale, data] of Object.entries(translations)) {
    const locale = assertLocale(rawLocale)
    if (locale === "en") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The default locale (en) is edited on the post row, not as a translation."
      )
    }
    const existing = (
      await service.listCmsBlogPostTranslations({ post_id: postId, locale })
    )?.[0]

    if (existing) {
      await service.updateCmsBlogPostTranslations({ id: existing.id, ...data })
    } else {
      await service.createCmsBlogPostTranslations({
        post_id: postId,
        locale,
        ...data,
      })
    }
  }
}

/**
 * PUT /admin/cms/blog/posts/:id
 * Update post draft fields, author, categories (replace set via `category_ids`),
 * and/or per-locale translations. Slug uniqueness is re-checked. Publishing state
 * transitions go through /posts/:id/publish, but `status` may still be edited
 * here (e.g. demote to draft) — note that does NOT emit revalidation; use the
 * publish endpoint for store-visible changes.
 *
 * Response: { post }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}

  const tenantId = await requireWriteTenant(req)

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

  if (body.translations && typeof body.translations === "object") {
    await upsertPostTranslations(service, id, body.translations)
  }

  const post = await service.retrieveCmsBlogPost(id, {
    relations: [...BLOG_POST_RELATIONS],
  })

  await recordBlogAudit(req, service, "blog_post.update", "blog_post", id, {
    before,
    after: post,
  })

  res.json({ post })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/blog/posts/:id
 * Soft-delete the post (cascades to translation rows; category links detach).
 * Response: { id, object: "blog_post", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)

  const before = await loadPost(service, id, tenantId)

  await service.softDeleteCmsBlogPosts(id)

  await recordBlogAudit(req, service, "blog_post.delete", "blog_post", id, {
    before,
  })

  res.json({ id, object: "blog_post", deleted: true })
}
