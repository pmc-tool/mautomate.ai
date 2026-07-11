import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import {
  BLOG_POST_RELATIONS,
  estimateReadingTime,
  one,
  recordBlogAudit,
  resolveUniqueSlug,
} from "../_helpers"

/**
 * GET /admin/cms/blog/posts
 * List blog posts (shallow + author/categories), paginated. Query:
 *   q?         — title/slug ilike
 *   status?    — "draft" | "published"
 *   author_id? — filter by author
 *   category_id? — filter by a linked category
 *   limit, offset
 *
 * Response: { posts, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const q = (req.query.q as string | undefined)?.trim()
  const status = req.query.status as string | undefined
  const authorId = req.query.author_id as string | undefined
  const categoryId = req.query.category_id as string | undefined
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  // Pooled multi-tenant: scope to the acting store. Fail-closed empty list.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ posts: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, unknown> = { tenant_id: tenantId }
  if (status) {
    filters.status = status
  }
  if (authorId) {
    filters.author_id = authorId
  }
  if (categoryId) {
    filters.categories = { id: categoryId }
  }
  if (q) {
    filters.$or = [
      { title: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ]
  }

  const [posts, count] = await service.listAndCountCmsBlogPosts(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
    relations: ["author", "categories"],
  })

  res.json({ posts, count, limit, offset })
}

type CreateBody = {
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

/**
 * POST /admin/cms/blog/posts
 * Create a blog post (draft by default). Slug is derived from the title when
 * omitted with a friendly 422 on collision. `reading_time` is auto-estimated
 * from the content when not supplied. Categories are linked via `category_ids`.
 *
 * NOTE: this does NOT publish — call POST /posts/:id/publish to go live.
 *
 * Body: { title, slug?, excerpt?, content?, cover_image?, author_id?,
 *         category_ids?, seo_*?, reading_time? }   Response: { post }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const body = req.body ?? {}

  // Pooled multi-tenant: writes require a resolvable store. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const title = (body.title ?? "").trim()
  if (!title) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`title` is required to create a blog post."
    )
  }

  const slug = await resolveUniqueSlug(
    (f) => service.listCmsBlogPosts(f),
    body.slug,
    title,
    undefined,
    tenantId
  )

  const status = body.status === "published" ? "published" : "draft"

  const created = one(
    await service.createCmsBlogPosts({
      tenant_id: tenantId,
      title,
      slug,
      excerpt: body.excerpt ?? null,
      content: body.content ?? null,
      cover_image: body.cover_image ?? null,
      status,
      // Stamp published_at if created directly as published.
      published_at:
        status === "published"
          ? body.published_at
            ? new Date(body.published_at)
            : new Date()
          : body.published_at
          ? new Date(body.published_at)
          : null,
      scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
      seo_title: body.seo_title ?? null,
      seo_description: body.seo_description ?? null,
      og_image: body.og_image ?? null,
      reading_time:
        body.reading_time ?? estimateReadingTime(body.content ?? null),
      author_id: body.author_id ?? null,
      categories: body.category_ids ?? [],
    })
  )

  const post = await service.retrieveCmsBlogPost(created.id, {
    relations: [...BLOG_POST_RELATIONS],
  })

  await recordBlogAudit(
    req,
    service,
    "blog_post.create",
    "blog_post",
    created.id,
    { after: post }
  )

  res.status(201).json({ post })
}
