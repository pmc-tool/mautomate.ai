/**
 * Forever Finds CMS — admin Blog data layer (Phase 8).
 *
 * Thin typed wrappers over the /admin/cms/blog/* API (cookie-session auth via
 * credentials:"include", behind the /admin/cms/* requireAuthenticatedAdmin
 * guard). Every helper returns parsed JSON or throws an Error carrying the
 * backend's friendly message so callers can `toast.error(e.message)`.
 *
 * This file is NOT a route — the admin router only registers `page.tsx` files,
 * so a plain `lib.ts` next to them is import-only.
 *
 * Shapes mirror the admin API contract EXACTLY:
 *   POSTS
 *     GET    /admin/cms/blog/posts            -> { posts, count, limit, offset }
 *     POST   /admin/cms/blog/posts            -> { post } (201)
 *     GET    /admin/cms/blog/posts/:id        -> { post }
 *     PUT    /admin/cms/blog/posts/:id        -> { post }
 *     DELETE /admin/cms/blog/posts/:id        -> { id, object, deleted }
 *     POST   /admin/cms/blog/posts/:id/publish (now or schedule)
 *     DELETE /admin/cms/blog/posts/:id/publish (unpublish)
 *   CATEGORIES /admin/cms/blog/categories[/:id]
 *   AUTHORS    /admin/cms/blog/authors[/:id]
 */

/* ------------------------------------------------------------------ */
/* Locale                                                              */
/* ------------------------------------------------------------------ */

export type Locale = "en" | "bn"
export const LOCALES: Locale[] = ["en", "bn"]
export const DEFAULT_LOCALE: Locale = "en"
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  bn: "বাংলা",
}

/* ------------------------------------------------------------------ */
/* Types (mirror the backend cms_blog_* contract)                      */
/* ------------------------------------------------------------------ */

export type BlogPostStatus = "draft" | "published"

export type BlogAuthor = {
  id: string
  name: string
  slug: string
  bio?: string | null
  avatar?: string | null
}

export type BlogCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
}

export type BlogPostTranslation = {
  id: string
  locale: string
  title?: string | null
  excerpt?: string | null
  content?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
}

/** Row shape returned by the list endpoint (author + categories relations). */
export type BlogPostRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  status: BlogPostStatus
  published_at: string | null
  scheduled_at: string | null
  reading_time: number | null
  created_at: string
  updated_at: string
  author?: BlogAuthor | null
  categories?: BlogCategory[]
}

/** Full post incl. content + SEO + translations (get/create/update). */
export type BlogPostFull = BlogPostRow & {
  content: string | null
  seo_title: string | null
  seo_description: string | null
  og_image: string | null
  author_id: string | null
  translations?: BlogPostTranslation[]
}

export type PostTranslationInput = {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
}

export type PostScalarInput = {
  title?: string
  slug?: string
  excerpt?: string | null
  content?: string | null
  cover_image?: string | null
  status?: BlogPostStatus
  published_at?: string | null
  scheduled_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
  reading_time?: number | null
  author_id?: string | null
  category_ids?: string[]
  translations?: Record<string, PostTranslationInput>
}

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & {
      status?: number
      errors?: string[]
    }
    err.status = res.status
    err.errors = payload?.errors
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

export function listPosts(params: {
  q?: string
  status?: BlogPostStatus | ""
  author_id?: string
  category_id?: string
  limit?: number
  offset?: number
}): Promise<{
  posts: BlogPostRow[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params.q?.trim()) qs.set("q", params.q.trim())
  if (params.status) qs.set("status", params.status)
  if (params.author_id) qs.set("author_id", params.author_id)
  if (params.category_id) qs.set("category_id", params.category_id)
  qs.set("limit", String(params.limit ?? 50))
  qs.set("offset", String(params.offset ?? 0))
  return api(`/admin/cms/blog/posts?${qs.toString()}`)
}

export function createPost(
  body: PostScalarInput
): Promise<{ post: BlogPostFull }> {
  return api(`/admin/cms/blog/posts`, { method: "POST", json: body })
}

export function getPost(id: string): Promise<{ post: BlogPostFull }> {
  return api(`/admin/cms/blog/posts/${id}`)
}

export function updatePost(
  id: string,
  body: PostScalarInput
): Promise<{ post: BlogPostFull }> {
  return api(`/admin/cms/blog/posts/${id}`, { method: "PUT", json: body })
}

export function deletePost(
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return api(`/admin/cms/blog/posts/${id}`, { method: "DELETE" })
}

/**
 * Publish now (omit `scheduled_at`) or schedule a future publish (pass a future
 * ISO string). Returns the updated post; `published` xor `scheduled` is set.
 */
export function publishPost(
  id: string,
  scheduledAt?: string | null
): Promise<{
  published?: boolean
  scheduled?: boolean
  scheduled_at?: string
  post: BlogPostFull
}> {
  return api(`/admin/cms/blog/posts/${id}/publish`, {
    method: "POST",
    json: scheduledAt ? { scheduled_at: scheduledAt } : {},
  })
}

/** Unpublish a published post (status -> draft, re-emits revalidation). */
export function unpublishPost(
  id: string
): Promise<{ unpublished: boolean; post: BlogPostFull }> {
  return api(`/admin/cms/blog/posts/${id}/publish`, { method: "DELETE" })
}

/** Cancel a pending scheduled publish by clearing `scheduled_at`. */
export function cancelSchedule(
  id: string
): Promise<{ post: BlogPostFull }> {
  return updatePost(id, { scheduled_at: null })
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export function listCategories(params?: {
  q?: string
  limit?: number
  offset?: number
}): Promise<{
  categories: BlogCategory[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.q?.trim()) qs.set("q", params.q.trim())
  qs.set("limit", String(params?.limit ?? 200))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/cms/blog/categories?${qs.toString()}`)
}

export function createCategory(body: {
  name: string
  slug?: string
  description?: string | null
}): Promise<{ category: BlogCategory }> {
  return api(`/admin/cms/blog/categories`, { method: "POST", json: body })
}

export function updateCategory(
  id: string,
  body: { name?: string; slug?: string; description?: string | null }
): Promise<{ category: BlogCategory }> {
  return api(`/admin/cms/blog/categories/${id}`, { method: "PUT", json: body })
}

export function deleteCategory(
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return api(`/admin/cms/blog/categories/${id}`, { method: "DELETE" })
}

/* ------------------------------------------------------------------ */
/* Authors                                                             */
/* ------------------------------------------------------------------ */

export function listAuthors(params?: {
  q?: string
  limit?: number
  offset?: number
}): Promise<{
  authors: BlogAuthor[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.q?.trim()) qs.set("q", params.q.trim())
  qs.set("limit", String(params?.limit ?? 200))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/cms/blog/authors?${qs.toString()}`)
}

export function createAuthor(body: {
  name: string
  slug?: string
  bio?: string | null
  avatar?: string | null
}): Promise<{ author: BlogAuthor }> {
  return api(`/admin/cms/blog/authors`, { method: "POST", json: body })
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export const STATUS_BADGE: Record<
  BlogPostStatus,
  { label: string; color: "green" | "grey" }
> = {
  draft: { label: "Draft", color: "grey" },
  published: { label: "Published", color: "green" },
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export const formatDate = (iso: string | null): string => {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/** The bn (non-default) translation override for a post, or an empty object. */
export function postTranslation(
  post: BlogPostFull | null | undefined,
  locale: Locale
): BlogPostTranslation | undefined {
  if (!post || locale === "en") return undefined
  return post.translations?.find((t) => t.locale === locale)
}
