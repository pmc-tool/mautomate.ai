import { ApiError, apiUrl } from "./api"

/**
 * Merchant blog API client (/merchant/blog/*). Kept in its own module so the
 * already-huge api.ts stays untouched; re-uses its apiUrl (same-origin edge
 * proxy) + ApiError conventions.
 */

export type BlogCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
  created_at?: string
}

export type BlogAuthor = {
  id: string
  name: string
  slug: string
  bio?: string | null
  avatar?: string | null
}

export type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content?: string | null
  cover_image?: string | null
  status: "draft" | "published"
  published_at?: string | null
  scheduled_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
  reading_time?: number | null
  author_id?: string | null
  author?: BlogAuthor | null
  categories?: BlogCategory[]
  created_at: string
  updated_at?: string
}

export type BlogPostInput = {
  title?: string
  slug?: string
  excerpt?: string | null
  content?: string | null
  cover_image?: string | null
  status?: "draft" | "published"
  seo_title?: string | null
  seo_description?: string | null
  og_image?: string | null
  author_id?: string | null
  category_ids?: string[]
}

async function blogErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return data?.message || fallback
  } catch {
    return fallback
  }
}

async function blogRequest<T>(
  path: string,
  opts: { method?: string; token: string; body?: unknown }
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${opts.token}`,
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (!res.ok) {
    throw new ApiError(await blogErrorMessage(res, "Request failed"), res.status)
  }
  return (await res.json()) as T
}

// --- Posts -------------------------------------------------------------------

export async function listBlogPosts(
  token: string,
  params: { q?: string; status?: string; limit?: number; offset?: number } = {}
): Promise<{ posts: BlogPost[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  if (params.status) qs.set("status", params.status)
  if (params.limit !== undefined) qs.set("limit", String(params.limit))
  if (params.offset !== undefined) qs.set("offset", String(params.offset))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return blogRequest(`/merchant/blog/posts${suffix}`, { token })
}

export async function getBlogPost(
  token: string,
  id: string
): Promise<{ post: BlogPost }> {
  return blogRequest(`/merchant/blog/posts/${id}`, { token })
}

export async function createBlogPost(
  token: string,
  body: BlogPostInput
): Promise<{ post: BlogPost }> {
  return blogRequest(`/merchant/blog/posts`, { method: "POST", token, body })
}

export async function updateBlogPost(
  token: string,
  id: string,
  body: BlogPostInput
): Promise<{ post: BlogPost }> {
  return blogRequest(`/merchant/blog/posts/${id}`, { method: "PUT", token, body })
}

export async function deleteBlogPost(token: string, id: string): Promise<void> {
  await blogRequest(`/merchant/blog/posts/${id}`, { method: "DELETE", token })
}

/** Publish now, or schedule when `scheduled_at` is a future ISO timestamp. */
export async function publishBlogPost(
  token: string,
  id: string,
  scheduledAt?: string | null
): Promise<{ published?: boolean; scheduled?: boolean; post: BlogPost }> {
  return blogRequest(`/merchant/blog/posts/${id}/publish`, {
    method: "POST",
    token,
    body: scheduledAt ? { scheduled_at: scheduledAt } : {},
  })
}

export async function unpublishBlogPost(
  token: string,
  id: string
): Promise<{ unpublished: boolean; post: BlogPost }> {
  return blogRequest(`/merchant/blog/posts/${id}/publish`, {
    method: "DELETE",
    token,
  })
}

// --- Categories ---------------------------------------------------------------

export async function listBlogCategories(
  token: string
): Promise<{ categories: BlogCategory[]; count: number }> {
  return blogRequest(`/merchant/blog/categories`, { token })
}

export async function createBlogCategory(
  token: string,
  body: { name: string; slug?: string; description?: string | null }
): Promise<{ category: BlogCategory }> {
  return blogRequest(`/merchant/blog/categories`, { method: "POST", token, body })
}

export async function updateBlogCategory(
  token: string,
  id: string,
  body: { name?: string; slug?: string; description?: string | null }
): Promise<{ category: BlogCategory }> {
  return blogRequest(`/merchant/blog/categories/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteBlogCategory(
  token: string,
  id: string
): Promise<void> {
  await blogRequest(`/merchant/blog/categories/${id}`, {
    method: "DELETE",
    token,
  })
}

// --- Authors -------------------------------------------------------------------

export async function listBlogAuthors(
  token: string
): Promise<{ authors: BlogAuthor[]; count: number }> {
  return blogRequest(`/merchant/blog/authors`, { token })
}

export async function createBlogAuthor(
  token: string,
  body: { name: string; slug?: string; bio?: string | null; avatar?: string | null }
): Promise<{ author: BlogAuthor }> {
  return blogRequest(`/merchant/blog/authors`, { method: "POST", token, body })
}

// --- Media ---------------------------------------------------------------------

/** Upload a blog image (cover / inline). Returns the tenant-namespaced URL. */
export async function uploadBlogMedia(
  token: string,
  file: File
): Promise<{ url: string; file_id: string }> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(apiUrl(`/merchant/blog/media`), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  })

  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (!res.ok) {
    throw new ApiError(await blogErrorMessage(res, "Image upload failed"), res.status)
  }
  return (await res.json()) as { url: string; file_id: string }
}

// --- AI generation -------------------------------------------------------------

export type BlogAiDraft = {
  title: string
  excerpt: string
  content_html: string
  seo_title: string
  seo_description: string
}

/** Draft a complete post with AI (metered as ai_text). */
export async function composeBlogPost(
  token: string,
  body: { brief: string; tone?: string; length?: string }
): Promise<{ draft: BlogAiDraft; credits: number }> {
  return blogRequest(`/merchant/blog/ai/compose`, { method: "POST", token, body })
}

export type BlogImageRequest = {
  prompt?: string
  product_image_url?: string | null
  context?: { title?: string; excerpt?: string }
  orientation?: "landscape" | "portrait" | "square"
}

/** Generate a blog image (optionally product-anchored; metered as ai_image). */
export async function generateBlogImage(
  token: string,
  body: BlogImageRequest
): Promise<{ url: string; engine: string; credits: number }> {
  return blogRequest(`/merchant/blog/ai/image`, { method: "POST", token, body })
}

/** Generate a short blog clip from a prompt (metered as ai_video, takes minutes). */
export async function generateBlogVideo(
  token: string,
  prompt: string,
  orientation?: "landscape" | "portrait" | "square"
): Promise<{ video_url: string; poster_url: string; credits: number }> {
  return blogRequest(`/merchant/blog/ai/video`, {
    method: "POST",
    token,
    body: { prompt, orientation },
  })
}

// --- Blog Autopilot ------------------------------------------------------------

export type BlogAutopilot = {
  enabled: boolean
  topics: string
  tone: string
  length: string
  frequency: "daily" | "weekly"
  weekday: number
  hour: number
  mode: "draft" | "publish"
  ai_cover: boolean
  last_run_at: string | null
  last_post_id: string | null
  last_error: string | null
}

export async function getBlogAutopilot(
  token: string
): Promise<{ autopilot: BlogAutopilot }> {
  return blogRequest(`/merchant/blog/autopilot`, { token })
}

export async function updateBlogAutopilot(
  token: string,
  body: Partial<BlogAutopilot>
): Promise<{ autopilot: BlogAutopilot }> {
  return blogRequest(`/merchant/blog/autopilot`, { method: "PUT", token, body })
}
