import "server-only"

import { cache } from "react"
import { sdk } from "@lib/config"
import {
  resolveActiveCmsLocale,
  currentTenantId,
  cmsCacheOptions,
  type CmsLocale,
} from "./cms"

/* ------------------------------------------------------------------ */
/* Blog read model (mirrors backend STORE API contract — Phase 8).     */
/* All store blog reads serve PUBLISHED posts only and resolve to the  */
/* requested locale (translation[field] ?? post[field]; en lives on    */
/* the base post). Each shaped post echoes `locale` (requested) +      */
/* `resolved_locale` (the locale actually served).                     */
/* ------------------------------------------------------------------ */

export interface BlogAuthorRef {
  id: string
  name: string
  slug: string
  avatar: string | null
}

export interface BlogCategoryRef {
  id: string
  name: string
  slug: string
}

/** PostCard shape returned by the list + related rails. */
export interface BlogPostCard {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  reading_time: number | null
  published_at: string | null
  author: BlogAuthorRef | null
  categories: BlogCategoryRef[]
  locale: string
  resolved_locale: string
}

/** Category with its exact PUBLISHED post count (locale-invariant). */
export interface BlogCategoryWithCount {
  id: string
  name: string
  slug: string
  description: string | null
  post_count: number
}

export interface BlogPostsResult {
  posts: BlogPostCard[]
  count: number
  limit: number
  offset: number
  locale: string
}

export interface BlogCategoriesResult {
  categories: BlogCategoryWithCount[]
  count: number
}

type StoreBlogPostsResponse = {
  posts: BlogPostCard[]
  count: number
  limit: number
  offset: number
  locale: string
}

type StoreBlogCategoriesResponse = {
  categories: BlogCategoryWithCount[]
  count: number
}

/* ------------------------------------------------------------------ */
/* Cache tags — cacheId-free (see getCmsSettings rationale). GLOBAL in  */
/* single-tenant; tenant-SUFFIXED on the pooled multi-tenant storefront */
/* (see cmsBlogTag / cmsBlogPostTag below). A blog publish/unpublish/   */
/* edit emits cms.published(entity_type "blog_post"), whose subscriber  */
/* POSTs /api/cms/revalidate with the matching per-tenant tags;         */
/* revalidateTag purges the list + categories + detail reads below.     */
/* ------------------------------------------------------------------ */

export const BLOG_LIST_TAG = "cms-blog"

/**
 * Pooled multi-tenant blog cache tags. On the shared storefront the tenant is
 * only a request HEADER (not part of Next's Data Cache key), so blog reads are
 * rendered dynamically (see cmsCacheOptions) AND tagged per tenant here — a
 * publish then purges only that tenant's entries. These MUST match the backend
 * cms.published subscriber (buildTags) BYTE-FOR-BYTE. Single-tenant / unknown
 * tenant: the legacy GLOBAL tags, unchanged.
 */
function cmsBlogTag(tenantId: string): string {
  return tenantId ? `cms-blog-${tenantId}` : BLOG_LIST_TAG
}

function cmsBlogPostTag(tenantId: string, slug: string): string {
  return tenantId
    ? `cms-blog-post-${tenantId}-${slug}`
    : `cms-blog-post-${slug}`
}

/** Default page size for the storefront blog listing. */
export const BLOG_PAGE_SIZE = 12

/* ------------------------------------------------------------------ */
/* Fetchers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch a paginated page of PUBLISHED blog posts, resolved to the active
 * CMS locale. Optionally filtered by category SLUG (manyToMany filter).
 *
 * - Tag: tenant-suffixed `cms-blog-<tenantId>` on the pooled multi-tenant
 *   storefront (rendered dynamically so a cached page can't cross stores),
 *   else the GLOBAL `cms-blog`; a publish `revalidateTag` purges this entry.
 * - Locale passed via BOTH the `x-medusa-locale` header (primary) and the
 *   `lang` query param (Medusa reserves/strips the `locale` query param).
 * - Never throws: returns an empty page on any failure so the route renders.
 *
 * Wrapped in React `cache()` for request-scoped de-duplication.
 */
export const getBlogPosts = cache(
  async (params?: {
    category?: string
    limit?: number
    offset?: number
    locale?: string
  }): Promise<BlogPostsResult> => {
    const resolvedLocale: CmsLocale = await resolveActiveCmsLocale(
      params?.locale
    )
    const limit = params?.limit ?? BLOG_PAGE_SIZE
    const offset = params?.offset ?? 0

    const query: Record<string, string | number> = {
      lang: resolvedLocale,
      limit,
      offset,
    }
    if (params?.category) {
      query.category = params.category
    }

    try {
      const tenantId = await currentTenantId()
      const res = await sdk.client.fetch<StoreBlogPostsResponse>(
        "/store/cms/blog/posts",
        {
          method: "GET",
          query,
          headers: { "x-medusa-locale": resolvedLocale },
          next: cmsCacheOptions([cmsBlogTag(tenantId)]),
        }
      )

      return {
        posts: res?.posts ?? [],
        count: res?.count ?? 0,
        limit: res?.limit ?? limit,
        offset: res?.offset ?? offset,
        locale: res?.locale ?? resolvedLocale,
      }
    } catch {
      return { posts: [], count: 0, limit, offset, locale: resolvedLocale }
    }
  }
)

/**
 * Fetch all blog categories with their exact PUBLISHED post counts.
 *
 * - Shares the blog list tag `cms-blog-<tenantId>` (GLOBAL `cms-blog` in
 *   single-tenant); counts rebuild when a post publishes.
 * - Never throws: returns an empty list on any failure.
 *
 * Wrapped in React `cache()` for request-scoped de-duplication.
 */
export const getBlogCategories = cache(
  async (locale?: string): Promise<BlogCategoriesResult> => {
    const resolvedLocale: CmsLocale = await resolveActiveCmsLocale(locale)

    try {
      const tenantId = await currentTenantId()
      const res = await sdk.client.fetch<StoreBlogCategoriesResponse>(
        "/store/cms/blog/categories",
        {
          method: "GET",
          query: { lang: resolvedLocale },
          headers: { "x-medusa-locale": resolvedLocale },
          next: cmsCacheOptions([cmsBlogTag(tenantId)]),
        }
      )

      return {
        categories: res?.categories ?? [],
        count: res?.count ?? 0,
      }
    } catch {
      return { categories: [], count: 0 }
    }
  }
)

/* ================================================================== */
/* Single post (detail) — APPENDED by the blog-detail/RSS builder.     */
/* Reuses BlogPostCard / BlogAuthorRef / BlogCategoryRef / BLOG_LIST_  */
/* TAG above; adds the richer detail shapes + getBlogPost /            */
/* getRelatedPosts. Do not remove the list fetchers above.            */
/* ================================================================== */

/** Per-post detail cache tag — purged on that post's publish/unpublish. */
export const getBlogPostCacheTag = (slug: string) => `cms-blog-post-${slug}`

/** Author on the detail shape adds `bio` over the card's BlogAuthorRef. */
export interface BlogAuthorFull extends BlogAuthorRef {
  bio: string | null
}

/** Category on the detail shape adds `description` over BlogCategoryRef. */
export interface BlogCategoryFull extends BlogCategoryRef {
  description: string | null
}

export interface BlogPostSeo {
  title: string | null
  description: string | null
  og_image: string | null
}

/** Full single-post shape returned by GET /store/cms/blog/posts/:slug. */
export interface BlogPostDetail extends BlogPostCard {
  content: string | null
  author: BlogAuthorFull | null
  categories: BlogCategoryFull[]
  seo: BlogPostSeo
}

export interface BlogPostDetailResult {
  post: BlogPostDetail
  related: BlogPostCard[]
  locale: string
}

/**
 * Fetch a single PUBLISHED blog post by slug, resolved to the active CMS
 * locale, together with its `related` rail (up to 3 posts sharing a category,
 * topped up with recent posts so it is never empty).
 *
 * - Cache tags: tenant-suffixed `cms-blog-post-<tenantId>-<slug>` +
 *   `cms-blog-<tenantId>` on the pooled storefront (rendered dynamically), else
 *   GLOBAL `cms-blog-post-<slug>` + `cms-blog`; a publish/unpublish
 *   `revalidateTag` purges them.
 * - Locale via BOTH the `x-medusa-locale` header (primary) and `lang` query
 *   (Medusa reserves/strips the `locale` query param).
 * - Returns `null` on 404 (missing / unpublished / scheduled draft) or any
 *   transport error, so the page can call `notFound()`.
 *
 * Wrapped in React `cache()` so the page body and `generateMetadata` share a
 * single request-scoped fetch.
 */
export const getBlogPost = cache(
  async (
    slug: string,
    locale?: string
  ): Promise<BlogPostDetailResult | null> => {
    const resolvedLocale: CmsLocale = await resolveActiveCmsLocale(locale)

    try {
      const tenantId = await currentTenantId()
      const res = await sdk.client.fetch<BlogPostDetailResult>(
        `/store/cms/blog/posts/${encodeURIComponent(slug)}`,
        {
          method: "GET",
          query: { lang: resolvedLocale },
          headers: { "x-medusa-locale": resolvedLocale },
          next: cmsCacheOptions([
            cmsBlogPostTag(tenantId, slug),
            cmsBlogTag(tenantId),
          ]),
        }
      )

      if (!res?.post) {
        return null
      }

      return {
        post: res.post,
        related: res.related ?? [],
        locale: res.locale ?? resolvedLocale,
      }
    } catch {
      // 404 (missing/unpublished) or transport error → caller renders notFound.
      return null
    }
  }
)

/**
 * Convenience accessor for just the `related` rail of a post. Shares the
 * underlying `getBlogPost` fetch (React `cache()` de-dupes) so calling this
 * alongside `getBlogPost` costs no extra request.
 */
export const getRelatedPosts = cache(
  async (slug: string, locale?: string): Promise<BlogPostCard[]> => {
    const bundle = await getBlogPost(slug, locale)
    return bundle?.related ?? []
  }
)
