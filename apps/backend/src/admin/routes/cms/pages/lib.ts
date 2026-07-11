/**
 * Forever Finds CMS — admin Pages data layer (Phase 3).
 *
 * Thin typed wrappers over the /admin/cms/pages|sections API (cookie-session
 * auth via credentials:"include", behind the /admin/cms/* requireAuthenticatedAdmin
 * guard). Every helper returns parsed JSON or throws an Error carrying the
 * backend's friendly message so callers can `toast.error(e.message)`.
 *
 * This file is NOT a route — the admin router only registers `page.tsx` files,
 * so a plain `lib.ts` next to them is import-only.
 */
import type { BlockType, Locale } from "../../../../modules/cms/types"

/* ------------------------------------------------------------------ */
/* Types (mirror the backend cms_page / cms_section contract)          */
/* ------------------------------------------------------------------ */

export type PageStatus = "draft" | "active" | "archived"

export type CmsPageRow = {
  id: string
  slug: string
  title: string
  status: PageStatus
  is_home: boolean
  default_locale: string
  fallback_locale: string
  /**
   * When set (ISO timestamp), the cms-scheduled-publish cron job will publish
   * this page's default locale once `scheduled_at <= now`, then clear it back
   * to null. Null means no pending scheduled publish.
   */
  scheduled_at: string | null
  updated_at: string
  created_at: string
}

export type CmsSectionTranslation = {
  id: string
  locale: string
  data: Record<string, any>
}

export type CmsSection = {
  id: string
  type: BlockType
  rank: number
  enabled: boolean
  label: string | null
  data: Record<string, any>
  translations?: CmsSectionTranslation[]
}

export type CmsPageTranslation = {
  id: string
  locale: string
  title?: string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image?: string | null
}

export type CmsPageFull = CmsPageRow & {
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  og_image: string | null
  canonical_url: string | null
  sections: CmsSection[]
  translations: CmsPageTranslation[]
}

/**
 * Per-locale publish status for one page, mirroring the backend
 * GET /admin/cms/pages/:id `locale_status` contract.
 *   - published:               a live snapshot exists for (slug, locale).
 *   - version:                 the live snapshot version (null when never published).
 *   - published_at:            ISO timestamp of the live snapshot (null when never).
 *   - has_unpublished_changes: the draft has drifted past the live snapshot, so a
 *                              republish would change what the store serves. Always
 *                              false until the locale has been published once.
 */
export type LocaleStatus = {
  published: boolean
  version: number | null
  published_at: string | null
  has_unpublished_changes: boolean
}

/** locale_status keyed by locale code ("en" | "bn"). */
export type LocaleStatusMap = Record<Locale, LocaleStatus>

export type PageScalarInput = {
  title?: string
  slug?: string
  is_home?: boolean
  status?: PageStatus
  default_locale?: string
  fallback_locale?: string
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image?: string | null
  canonical_url?: string | null
  /**
   * Set to an ISO timestamp to schedule a publish, or null to cancel a pending
   * schedule. The scheduled-publish cron job publishes the page's default
   * locale when the time is reached.
   */
  scheduled_at?: string | null
  translations?: Record<string, Partial<CmsPageTranslation>>
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
    const err = new Error(message) as Error & { status?: number; errors?: string[] }
    err.status = res.status
    err.errors = payload?.errors
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function listPages(params: {
  q?: string
  status?: PageStatus | ""
  limit?: number
  offset?: number
}): Promise<{ pages: CmsPageRow[]; count: number; limit: number; offset: number }> {
  const qs = new URLSearchParams()
  if (params.q?.trim()) qs.set("q", params.q.trim())
  if (params.status) qs.set("status", params.status)
  qs.set("limit", String(params.limit ?? 50))
  qs.set("offset", String(params.offset ?? 0))
  return api(`/admin/cms/pages?${qs.toString()}`)
}

export function createPage(body: PageScalarInput): Promise<{ page: CmsPageFull }> {
  return api(`/admin/cms/pages`, { method: "POST", json: body })
}

export function getPage(
  id: string
): Promise<{ page: CmsPageFull; locale_status: LocaleStatusMap }> {
  return api(`/admin/cms/pages/${id}`)
}

export function updatePage(
  id: string,
  body: PageScalarInput
): Promise<{ page: CmsPageFull }> {
  return api(`/admin/cms/pages/${id}`, { method: "PUT", json: body })
}

export function deletePage(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/admin/cms/pages/${id}`, { method: "DELETE" })
}

export function publishPage(
  id: string,
  locale: Locale,
  note?: string
): Promise<{
  snapshot: {
    id: string
    version: number
    slug: string
    locale: string
    is_live: boolean
    published_at: string
  }
  published: boolean
}> {
  return api(`/admin/cms/pages/${id}/publish?locale=${locale}`, {
    method: "POST",
    json: note ? { note } : {},
  })
}

/* ------------------------------------------------------------------ */
/* Revisions (publish snapshot history)                                */
/* ------------------------------------------------------------------ */

/**
 * One compiled section inside a snapshot's `data.sections`. The publish step
 * flattens the resolved block fields next to `block_type` / `schema_version`,
 * so the remaining keys are the block's own payload.
 */
export type CompiledSection = {
  block_type: string
  schema_version?: number
  [key: string]: any
}

/**
 * The fully compiled, locale-resolved page payload stored in a snapshot's
 * `data` column — identical to what the storefront read endpoint returns.
 */
export type CompiledPageData = {
  slug?: string
  locale?: string
  resolved_locale?: string
  sections?: CompiledSection[]
  seo?: Record<string, any>
  meta?: {
    entity_type?: string
    entity_id?: string
    title?: string
    is_home?: boolean
    compiled_at?: string
    [key: string]: any
  }
  [key: string]: any
}

/**
 * Lightweight revision row from GET .../revisions (no heavy `data` field).
 * `published_by` is the admin user id that published the snapshot (nullable for
 * system/automation publishes).
 */
export type CmsRevisionRow = {
  id: string
  version: number
  is_live: boolean
  published_at: string | null
  published_by: string | null
  note: string | null
}

/** Full revision incl. the compiled `data`, from GET .../revisions/:version. */
export type CmsRevisionFull = CmsRevisionRow & {
  slug: string
  locale: string
  data: CompiledPageData
}

/** List every snapshot for (page, locale), newest version first. */
export function listRevisions(
  id: string,
  locale: Locale
): Promise<{
  page_id: string
  slug: string
  locale: string
  count: number
  revisions: CmsRevisionRow[]
}> {
  return api(`/admin/cms/pages/${id}/revisions?locale=${locale}`)
}

/** Fetch one full snapshot (incl. compiled `data`) by its monotonic version. */
export function getRevision(
  id: string,
  version: number,
  locale: Locale
): Promise<{ revision: CmsRevisionFull }> {
  return api(`/admin/cms/pages/${id}/revisions/${version}?locale=${locale}`)
}

/**
 * Roll back to a past published version. Append-only: the chosen version's data
 * is republished as a NEW top-of-history live snapshot (version max+1); the
 * original row is untouched. The draft sections are not modified.
 */
export function restoreRevision(
  id: string,
  version: number,
  locale: Locale
): Promise<{
  restored: true
  from_version: number
  snapshot: {
    id: string
    version: number
    slug: string
    locale: string
    is_live: boolean
    published_at: string
  }
}> {
  return api(`/admin/cms/pages/${id}/revisions/${version}/restore?locale=${locale}`, {
    method: "POST",
    json: { locale },
  })
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

/**
 * Response of the admin preview-token mint endpoint. `url` is a ready-to-open
 * storefront link (STOREFRONT_URL + /api/cms/preview?token=...&slug=...&locale=...)
 * that enables Next 15 draftMode and renders the current draft.
 */
export type PreviewTokenResponse = {
  token: string
  url: string
  exp: number
  slug: string
  locale: string
}

/**
 * Mint a short-lived signed preview token for (page, locale) and get back the
 * storefront preview URL to open. Locale is sent both as the query param
 * (matching publish) and in the body for robustness.
 */
export function mintPreviewToken(
  id: string,
  locale: Locale
): Promise<PreviewTokenResponse> {
  return api(`/admin/cms/pages/${id}/preview-token?locale=${locale}`, {
    method: "POST",
    json: { locale },
  })
}

/* ------------------------------------------------------------------ */
/* Schedule publish                                                    */
/* ------------------------------------------------------------------ */

/**
 * Schedule a future publish by writing `scheduled_at` (ISO string). The
 * cms-scheduled-publish cron job picks it up once the time passes and publishes
 * the page's default locale.
 */
export function schedulePublish(
  id: string,
  scheduledAt: string
): Promise<{ page: CmsPageFull }> {
  return updatePage(id, { scheduled_at: scheduledAt })
}

/** Cancel a pending scheduled publish by clearing `scheduled_at`. */
export function cancelSchedulePublish(
  id: string
): Promise<{ page: CmsPageFull }> {
  return updatePage(id, { scheduled_at: null })
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export function addSection(
  pageId: string,
  body: { type: BlockType; data?: Record<string, any>; label?: string | null }
): Promise<{ section: CmsSection }> {
  return api(`/admin/cms/pages/${pageId}/sections`, {
    method: "POST",
    json: body,
  })
}

export function reorderSections(
  pageId: string,
  orderedIds: string[]
): Promise<{ sections: CmsSection[] }> {
  return api(`/admin/cms/pages/${pageId}/sections/reorder`, {
    method: "POST",
    json: { orderedIds },
  })
}

export function updateSection(
  sectionId: string,
  body: {
    data?: Record<string, any>
    enabled?: boolean
    label?: string | null
    translations?: Record<string, Record<string, any>>
  }
): Promise<{ section: CmsSection }> {
  return api(`/admin/cms/sections/${sectionId}`, { method: "PUT", json: body })
}

export function deleteSection(
  sectionId: string
): Promise<{ id: string; deleted: boolean }> {
  return api(`/admin/cms/sections/${sectionId}`, { method: "DELETE" })
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export const STATUS_BADGE: Record<
  PageStatus,
  { label: string; color: "green" | "grey" | "orange" }
> = {
  draft: { label: "Draft", color: "grey" },
  active: { label: "Active", color: "green" },
  archived: { label: "Archived", color: "orange" },
}

/** The bn translation override data for a section (empty object when none). */
export function sectionTranslationData(
  section: CmsSection,
  locale: string
): Record<string, any> {
  if (locale === "en") return {}
  const t = section.translations?.find((x) => x.locale === locale)
  return t?.data ? { ...t.data } : {}
}
