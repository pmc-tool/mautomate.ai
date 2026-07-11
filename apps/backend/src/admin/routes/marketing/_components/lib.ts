/**
 * Marketing — admin data layer for the Compose editor and Post Hub (shared).
 *
 * Thin typed wrappers over /admin/marketing/* (cookie-session auth via
 * credentials:"include") plus the Medusa admin /admin/products picker. Every
 * helper returns parsed JSON or throws an Error carrying the backend's friendly
 * `message` so callers can `toast.error(e.message)`.
 *
 * This file is NOT a route — the admin router only registers `page.tsx` files,
 * so a plain `lib.ts` next to them is import-only (mirrors the call-center libs).
 *
 * The backend for these routes is built in parallel; every helper degrades
 * gracefully (404 / empty payloads are tolerated by the callers).
 */

/* ------------------------------------------------------------------ */
/* Platforms                                                           */
/* ------------------------------------------------------------------ */

export type Platform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "youtube"
  | "pinterest"

export type PlatformMeta = {
  value: Platform
  label: string
  /** Short chip abbreviation. */
  short: string
  /** Tailwind classes for the platform chip / preview accent. */
  accent: string
  /** Max characters the platform allows for a single post's body. */
  charLimit: number
  /** True when the platform will not publish without at least one media asset. */
  requiresMedia: boolean
}

export const PLATFORMS: PlatformMeta[] = [
  {
    value: "instagram",
    label: "Instagram",
    short: "IG",
    accent: "bg-ui-tag-purple-bg text-ui-tag-purple-text",
    charLimit: 2200,
    requiresMedia: true,
  },
  {
    value: "facebook",
    label: "Facebook",
    short: "FB",
    accent: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
    charLimit: 63206,
    requiresMedia: false,
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    short: "IN",
    accent: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
    charLimit: 3000,
    requiresMedia: false,
  },
  {
    value: "x",
    label: "X",
    short: "X",
    accent: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
    charLimit: 280,
    requiresMedia: false,
  },
  {
    value: "tiktok",
    label: "TikTok",
    short: "TT",
    accent: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
    charLimit: 2200,
    requiresMedia: true,
  },
  {
    value: "youtube",
    label: "YouTube",
    short: "YT",
    accent: "bg-ui-tag-red-bg text-ui-tag-red-text",
    charLimit: 5000,
    requiresMedia: true,
  },
  {
    value: "pinterest",
    label: "Pinterest",
    short: "PIN",
    accent: "bg-ui-tag-red-bg text-ui-tag-red-text",
    charLimit: 500,
    requiresMedia: true,
  },
]

export const PLATFORM_MAP: Record<Platform, PlatformMeta> = PLATFORMS.reduce(
  (acc, p) => {
    acc[p.value] = p
    return acc
  },
  {} as Record<Platform, PlatformMeta>
)

export function platformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_MAP[platform as Platform] ?? {
      value: platform as Platform,
      label: humanize(platform),
      short: platform.slice(0, 2).toUpperCase(),
      accent: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
      charLimit: 5000,
      requiresMedia: false,
    }
  )
}

/* ------------------------------------------------------------------ */
/* Status model                                                        */
/* ------------------------------------------------------------------ */

export type PostStatus =
  | "draft"
  | "needs_approval"
  | "scheduled"
  | "published"
  | "failed"

export type BadgeColor = "green" | "grey" | "orange" | "blue" | "red" | "purple"

export const POST_STATUS: Record<
  PostStatus,
  { label: string; color: BadgeColor }
> = {
  draft: { label: "Draft", color: "grey" },
  needs_approval: { label: "Needs approval", color: "orange" },
  scheduled: { label: "Scheduled", color: "blue" },
  published: { label: "Published", color: "green" },
  failed: { label: "Failed", color: "red" },
}

/** Column order for the Post Hub kanban board. */
export const STATUS_COLUMNS: PostStatus[] = [
  "draft",
  "needs_approval",
  "scheduled",
  "published",
  "failed",
]

export function statusMeta(status?: string | null): {
  label: string
  color: BadgeColor
} {
  if (status && POST_STATUS[status as PostStatus]) {
    return POST_STATUS[status as PostStatus]
  }
  return { label: humanize(status), color: "grey" }
}

/* Per-target publishing status (a subset the UI colour-codes). */
export function targetStatusMeta(status?: string | null): {
  label: string
  color: BadgeColor
} {
  switch (status) {
    case "published":
      return { label: "Published", color: "green" }
    case "scheduled":
      return { label: "Scheduled", color: "blue" }
    case "publishing":
      return { label: "Publishing", color: "orange" }
    case "failed":
      return { label: "Failed", color: "red" }
    case "draft":
      return { label: "Draft", color: "grey" }
    default:
      return { label: humanize(status), color: "grey" }
  }
}

/* ------------------------------------------------------------------ */
/* Types (mirror the marketing_post contract)                          */
/* ------------------------------------------------------------------ */

export type PostTarget = {
  id: string
  post_id?: string
  platform: Platform | string
  /** Platform-specific override; falls back to the master content when null. */
  content: string | null
  status: string | null
  error: string | null
  scheduled_at: string | null
  published_at: string | null
  external_url: string | null
}

export type PostMedia = {
  id: string
  post_id?: string
  url: string
  type: string | null
  alt: string | null
}

export type PostRevision = {
  id: string
  post_id?: string
  content: string | null
  label: string | null
  author: string | null
  created_at: string
}

export type Post = {
  id: string
  status: PostStatus | string
  /** Master content used when a target has no override. */
  content: string | null
  hashtags: string | null
  link: string | null
  product_ids: string[] | null
  platforms: (Platform | string)[] | null
  scheduled_at: string | null
  brand_voice_id: string | null
  tone: string | null
  length: string | null
  error: string | null
  created_at: string
  updated_at: string
}

/** A single post detail response bundles its related rows. */
export type PostDetail = {
  post: Post
  targets: PostTarget[]
  media: PostMedia[]
  revisions: PostRevision[]
}

export type GenerateInput = {
  prompt: string
  product_ids?: string[]
  platforms?: string[]
  brand_voice_id?: string | null
  tone?: string | null
  length?: string | null
}

export type BrandVoice = {
  id: string
  name: string
  tone?: string | null
  description?: string | null
}

/** A trimmed product shape for the picker. */
export type PickerProduct = {
  id: string
  title: string
  thumbnail: string | null
  status?: string | null
}

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

export async function api<T = any>(
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
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

export function listPosts(params?: {
  status?: PostStatus | ""
  limit?: number
  offset?: number
}): Promise<{
  posts: Post[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  qs.set("limit", String(params?.limit ?? 200))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/marketing/posts?${qs.toString()}`)
}

export function getPost(id: string): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}`)
}

/** Create a bare post (no AI). Returns the created post + any targets. */
export function createPost(body: {
  content?: string | null
  hashtags?: string | null
  link?: string | null
  product_ids?: string[]
  platforms?: string[]
  tone?: string | null
  length?: string | null
  brand_voice_id?: string | null
  targets?: { platform: string; content: string | null }[]
}): Promise<{ post: Post; targets?: PostTarget[] }> {
  return api(`/admin/marketing/posts`, { method: "POST", json: body })
}

/** Persist edits to an existing post. */
export function updatePost(
  id: string,
  body: Record<string, unknown>
): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}`, { method: "POST", json: body })
}

export function deletePost(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/admin/marketing/posts/${id}`, { method: "DELETE" })
}

/** Kick off an AI draft. Returns the created post and per-platform targets. */
export function generatePost(
  body: GenerateInput
): Promise<{ post: Post; targets: PostTarget[] }> {
  return api(`/admin/marketing/posts/generate`, { method: "POST", json: body })
}

export function tailorTarget(
  id: string,
  body: { platform: string; instruction: string }
): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}/tailor`, {
    method: "POST",
    json: body,
  })
}

export function reworkPost(
  id: string,
  body: { instruction: string }
): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}/rework`, {
    method: "POST",
    json: body,
  })
}

export function schedulePost(
  id: string,
  body: { scheduled_at: string | null }
): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}/schedule`, {
    method: "POST",
    json: body,
  })
}

/** action: "approve" | "reject" | "publish" — the backend validates it. */
export function approvePost(
  id: string,
  body: { action: string }
): Promise<PostDetail> {
  return api(`/admin/marketing/posts/${id}/approve`, {
    method: "POST",
    json: body,
  })
}

/** Inline "sparkle" transform of a snippet — shorten / punch up / hashtags. */
export function generateText(body: {
  prompt: string
  action: string
  product_ids?: string[]
}): Promise<{ text: string }> {
  return api(`/admin/marketing/generate-text`, { method: "POST", json: body })
}

export function listBrandVoices(): Promise<{ brand_voices: BrandVoice[] }> {
  return api(`/admin/marketing/brand-voice`)
}

/* ------------------------------------------------------------------ */
/* Products (Medusa admin API, for the attach-product picker)          */
/* ------------------------------------------------------------------ */

export async function searchProducts(params: {
  q?: string
  limit?: number
  offset?: number
}): Promise<{ products: PickerProduct[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  qs.set("limit", String(params.limit ?? 20))
  qs.set("offset", String(params.offset ?? 0))
  qs.set("fields", "id,title,thumbnail,status")
  const res = await api<{ products: any[]; count: number }>(
    `/admin/products?${qs.toString()}`
  )
  return {
    products: (res.products ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
      status: p.status ?? null,
    })),
    count: res.count ?? 0,
  }
}

/** Resolve a set of product ids to display chips (used by Compose). */
export async function getProductsByIds(
  ids: string[]
): Promise<PickerProduct[]> {
  if (!ids.length) return []
  const qs = new URLSearchParams()
  ids.forEach((id) => qs.append("id[]", id))
  qs.set("limit", String(ids.length))
  qs.set("fields", "id,title,thumbnail,status")
  try {
    const res = await api<{ products: any[] }>(`/admin/products?${qs.toString()}`)
    return (res.products ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
      status: p.status ?? null,
    }))
  } catch {
    return ids.map((id) => ({ id, title: id, thumbnail: null }))
  }
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export function humanize(v?: string | null): string {
  if (!v) return "—"
  return v
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function formatDateTime(iso?: string | null): string {
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

export function snippet(text?: string | null, max = 140): string {
  if (!text) return ""
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** Convert a datetime-local input value to an ISO string (or null). */
export function localInputToISO(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Convert an ISO string to a value a <input type="datetime-local"> accepts. */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}
