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
import { LOCALES, DEFAULT_LOCALE, type Locale } from "../../../../../modules/cms/types"
import {
  assertLocale,
  one,
  PAGE_TREE_RELATIONS,
  recordPageAudit,
  sortByRank,
} from "../_helpers"

/**
 * Load a page with its full draft tree (translations + sections + section
 * translations), sections sorted by rank. Throws NOT_FOUND if missing.
 */
async function loadPageTree(
  service: CmsModuleService,
  id: string,
  tenantId: string
) {
  let page: any
  try {
    page = await service.retrieveCmsPage(id, {
      relations: [...PAGE_TREE_RELATIONS],
    })
  } catch {
    page = null
  }
  // Ownership guard (pooled multi-tenant): a page id from another store is
  // treated as not-found (never leaked or mutated cross-tenant).
  if (!page || (page.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${id}" was not found.`
    )
  }
  if (Array.isArray(page.sections)) {
    page.sections = sortByRank(page.sections)
  }
  return page
}

/** Per-locale publish status for one page. */
type LocaleStatus = {
  // A live snapshot exists for (slug, locale).
  published: boolean
  // Live snapshot version (null when never published for this locale).
  version: number | null
  // ISO timestamp of the live snapshot (null when never published).
  published_at: string | null
  // The draft has edits newer than the live snapshot -> a republish would
  // change what the store serves. Always false when not yet published (the
  // `published` flag carries that signal instead).
  has_unpublished_changes: boolean
}

const ts = (v: unknown): number => {
  if (!v) return 0
  const t = new Date(v as string | number | Date).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * Compute, per locale, whether a live snapshot exists, its version, and whether
 * the draft has drifted past it. Cheap: one listCmsSnapshots query for the
 * page's slug; draft mtimes are read from the already-loaded tree.
 *
 * en draft mtime  = max(page.updated_at, every section.updated_at).
 * bn draft mtime  = max(en mtime, bn section-translation mtimes, bn
 *                   page-translation mtime) — because a bn snapshot is
 *                   deepMerge(en data, bn override), any en edit also staling bn.
 */
async function computeLocaleStatus(
  service: CmsModuleService,
  page: any,
  tenantId: string
): Promise<Record<Locale, LocaleStatus>> {
  const liveRows = await service.listCmsSnapshots({
    tenant_id: tenantId,
    entity_type: "page",
    slug: page.slug,
    is_live: true,
  })
  const liveByLocale = new Map<string, any>()
  for (const row of liveRows ?? []) {
    liveByLocale.set(row.locale, row)
  }

  const sections: any[] = page.sections ?? []
  const enMtime = Math.max(
    ts(page.updated_at),
    ...sections.map((s) => ts(s.updated_at))
  )

  const status = {} as Record<Locale, LocaleStatus>
  for (const locale of LOCALES) {
    let draftMtime = enMtime
    if (locale !== DEFAULT_LOCALE) {
      const sectionTransMtime = Math.max(
        0,
        ...sections.flatMap((s) =>
          (s.translations ?? [])
            .filter((t: any) => t.locale === locale)
            .map((t: any) => ts(t.updated_at))
        )
      )
      const pageTransMtime = Math.max(
        0,
        ...(page.translations ?? [])
          .filter((t: any) => t.locale === locale)
          .map((t: any) => ts(t.updated_at))
      )
      draftMtime = Math.max(enMtime, sectionTransMtime, pageTransMtime)
    }

    const live = liveByLocale.get(locale)
    const publishedAtMs = ts(live?.published_at)
    status[locale] = {
      published: !!live,
      version: live?.version ?? null,
      published_at: live?.published_at
        ? new Date(live.published_at).toISOString()
        : null,
      has_unpublished_changes: !!live && draftMtime > publishedAtMs,
    }
  }

  return status
}

/**
 * GET /admin/cms/pages/:id
 * Full DRAFT tree: page + translations + ordered sections + section
 * translations, plus per-locale publish status. Response: { page, locale_status }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${req.params.id}" was not found.`
    )
  }
  const page = await loadPageTree(service, req.params.id, tenantId)
  const locale_status = await computeLocaleStatus(service, page, tenantId)
  res.json({ page, locale_status })
}

type PageTranslationInput = {
  title?: string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image?: string | null
}

type UpdateBody = {
  title?: string
  slug?: string
  is_home?: boolean
  status?: "draft" | "active" | "archived"
  default_locale?: string
  fallback_locale?: string
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image?: string | null
  canonical_url?: string | null
  // ISO datetime to schedule a publish, or null to cancel.
  scheduled_at?: string | null
  // Per-locale page-level overrides: { bn: { title?, seo_*? } }.
  translations?: Record<string, PageTranslationInput>
}

const PAGE_SCALAR_FIELDS = [
  "title",
  "slug",
  "is_home",
  "status",
  "default_locale",
  "fallback_locale",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "og_image",
  "canonical_url",
  "scheduled_at",
] as const

/**
 * Upsert page-level translation rows for non-default locales. The default
 * locale (en) lives on the page row itself and is rejected here.
 */
async function upsertPageTranslations(
  service: CmsModuleService,
  pageId: string,
  translations: Record<string, PageTranslationInput>
) {
  for (const [rawLocale, data] of Object.entries(translations)) {
    const locale = assertLocale(rawLocale)
    if (locale === "en") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The default locale (en) is edited on the page row, not as a translation."
      )
    }
    const existing = (
      await service.listCmsPageTranslations({ page_id: pageId, locale })
    )?.[0]

    if (existing) {
      await service.updateCmsPageTranslations({
        id: existing.id,
        ...data,
      })
    } else {
      await service.createCmsPageTranslations({
        page_id: pageId,
        locale,
        ...data,
      })
    }
  }
}

/**
 * PUT /admin/cms/pages/:id
 * Update page draft fields (title/slug/seo/status/is_home) and/or per-locale
 * page translations. Slug uniqueness is re-checked. Response: { page }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}

  const tenantId = await requireWriteTenant(req)

  const before = await loadPageTree(service, id, tenantId)

  // Slug uniqueness pre-check (exclude self).
  if (body.slug && body.slug !== before.slug) {
    const clash = await service.listCmsPages({ tenant_id: tenantId, slug: body.slug })
    if (clash?.some((p: any) => p.id !== id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A page with slug "${body.slug}" already exists.`
      )
    }
  }

  const patch: Record<string, unknown> = { id }
  for (const field of PAGE_SCALAR_FIELDS) {
    if (field in body) {
      patch[field] = (body as Record<string, unknown>)[field]
    }
  }

  // Only call update when there is at least one scalar field beyond `id`.
  if (Object.keys(patch).length > 1) {
    await service.updateCmsPages(patch)
  }

  if (body.translations && typeof body.translations === "object") {
    await upsertPageTranslations(service, id, body.translations)
  }

  const page = await loadPageTree(service, id, tenantId)

  await recordPageAudit(req, service, "page.update", "page", id, {
    before,
    after: page,
  })

  res.json({ page })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/pages/:id
 * Soft-delete the page (cascades to sections/translations via the ORM).
 * Snapshots are intentionally retained (revision history). Builder B's store
 * read API still honors the live snapshot until it is taken down; archiving a
 * page (status="archived") is the editorial way to 404 the store.
 *
 * Response: { id, object: "page", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)

  const before = await loadPageTree(service, id, tenantId)

  await service.softDeleteCmsPages(id)

  await recordPageAudit(req, service, "page.delete", "page", id, { before })

  res.json({ id, object: "page", deleted: true })
}
