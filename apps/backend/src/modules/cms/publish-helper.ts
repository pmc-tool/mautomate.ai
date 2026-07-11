import { MedusaError, Modules } from "@medusajs/framework/utils"
import type {
  IEventBusModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { CMS_MODULE } from "."
import type CmsModuleService from "./service"
import { deepMerge, type Locale } from "./types"
import { schemaVersionFor, validateBlockData } from "./registry"

/**
 * Shared publish pipeline (phase-6).
 *
 * The admin publish ROUTE and the scheduled-publish JOB must produce byte-for-
 * byte identical snapshots, so the compile + validate + publishSnapshot logic
 * lives here ONCE and both callers invoke it. The route adds HTTP concerns
 * (422 body, actor audit); the job adds the due-sweep + scheduled_at clearing.
 *
 * This module is part of the CMS module layer and intentionally does NOT import
 * anything from the api/ layer.
 */

/** Domain event emitted after a successful snapshot write. */
export const CMS_PUBLISHED_EVENT = "cms.published"

/** Payload for {@link CMS_PUBLISHED_EVENT}. */
export type CmsPublishedEvent = {
  /**
   * "page" (a cms_page snapshot), "global" (a settings singleton), or
   * "blog_post" (a published cms_blog_post — Phase 8). The subscriber maps each
   * to the storefront cache tags it invalidates.
   */
  entity_type: "page" | "global" | "blog_post"
  /** Route slug for pages/posts; the setting key for globals. */
  slug: string
  /**
   * Target locale, or null for locale-invariant entities (settings, and blog
   * posts — which are resolved per-locale at read time off global blog tags).
   */
  locale: string | null
  /**
   * Publishing tenant (pooled multi-tenant). Threaded through to the storefront
   * revalidate call so only THIS tenant's cache tags/paths are purged on the
   * shared Next server. Optional/null for single-tenant or legacy callers, in
   * which case the subscriber falls back to the legacy GLOBAL tags.
   */
  tenant_id?: string | null
}

type CompiledSection = {
  block_type: string
  schema_version: number
  [key: string]: unknown
}

/** Page draft relations needed to compile a snapshot. */
export const PUBLISH_PAGE_RELATIONS = [
  "translations",
  "sections",
  "sections.translations",
] as const

/** Sort sections by rank ascending (stable). Local copy to avoid api/ imports. */
function sortByRank<T extends { rank?: number }>(sections: T[]): T[] {
  return [...sections].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
}

/** Resolve the locale-merged SEO block for the snapshot. */
function resolveSeo(page: any, locale: Locale) {
  const base = {
    title: page.seo_title ?? null,
    description: page.seo_description ?? null,
    keywords: page.seo_keywords ?? null,
    og_image: page.og_image ?? null,
    canonical_url: page.canonical_url ?? null,
  }
  if (locale === "en") {
    return base
  }
  const t = (page.translations ?? []).find((tr: any) => tr.locale === locale)
  if (!t) {
    return base
  }
  return {
    title: t.seo_title ?? base.title,
    description: t.seo_description ?? base.description,
    keywords: t.seo_keywords ?? base.keywords,
    og_image: t.og_image ?? base.og_image,
    canonical_url: base.canonical_url,
  }
}

/**
 * Compile a loaded page draft tree into the immutable, locale-resolved snapshot
 * payload. Pure (no I/O). Returns either the compiled payload or the list of
 * block validation errors — callers decide how to surface them.
 */
export function compilePageSnapshot(
  page: any,
  locale: Locale
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: string[] } {
  const enabled: any[] = sortByRank(
    (page.sections ?? []).filter((s: any) => s.enabled !== false)
  )

  const sections: CompiledSection[] = []
  const errors: string[] = []

  for (const section of enabled) {
    const override = (section.translations ?? []).find(
      (tr: any) => tr.locale === locale
    )
    const resolved =
      locale === "en" || !override
        ? section.data ?? {}
        : deepMerge(section.data ?? {}, override.data ?? {})

    const result = validateBlockData(section.type, resolved)
    if (!result.valid) {
      const label = section.label ? ` (${section.label})` : ""
      for (const err of result.errors) {
        errors.push(`section ${section.id}${label}: ${err}`)
      }
    }

    sections.push({
      block_type: section.type,
      schema_version: schemaVersionFor(section.type),
      ...(resolved as Record<string, unknown>),
    })
  }

  if (errors.length) {
    return { ok: false, errors }
  }

  const data = {
    slug: page.slug,
    locale,
    resolved_locale: locale,
    sections,
    seo: resolveSeo(page, locale),
    meta: {
      entity_type: "page",
      entity_id: page.id,
      title: page.title,
      is_home: page.is_home === true,
      compiled_at: new Date().toISOString(),
    },
  }

  return { ok: true, data }
}

/**
 * Emit {@link CMS_PUBLISHED_EVENT}. Best-effort: a missing/failing event bus must
 * never roll back or fail the publish (the snapshot is already durably written).
 */
export async function emitCmsPublished(
  container: MedusaContainer,
  payload: CmsPublishedEvent
): Promise<void> {
  try {
    const eventBus = container.resolve<IEventBusModuleService>(
      Modules.EVENT_BUS
    )
    await eventBus.emit({ name: CMS_PUBLISHED_EVENT, data: payload })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[cms] failed to emit ${CMS_PUBLISHED_EVENT} (non-blocking):`,
      e
    )
  }
}

export type PublishPageInput = {
  /** Provide a pre-loaded page tree, OR a pageId to load it here. */
  page?: any
  pageId?: string
  /**
   * Owning tenant (pooled multi-tenant). Required — the loaded page must belong
   * to it, the en-before-bn guard is scoped by it, and the snapshot is stamped
   * with it. May be null only for legacy single-tenant seed scripts.
   */
  tenant_id: string | null
  locale: Locale
  note?: string | null
  published_by?: string | null
  /** Skip emitting the domain event (rarely needed; default emits). */
  skipEvent?: boolean
}

export type PublishPageResult =
  | { ok: true; snapshot: any; page: any }
  | { ok: false; errors: string[]; page: any }

/**
 * Full page publish pipeline shared by the route and the scheduled job:
 *   1. load the draft tree (if only an id was given),
 *   2. reject archived pages (NOT_ALLOWED),
 *   3. en-before-bn guard (NOT_ALLOWED),
 *   4. compile + validate — on failure return { ok: false, errors } WITHOUT
 *      writing a snapshot,
 *   5. publishSnapshot (version++ / demote prior live / insert new live),
 *   6. emit cms.published (best-effort).
 *
 * Throws MedusaError for NOT_FOUND / NOT_ALLOWED so the route can map them to
 * HTTP statuses and the job can catch + skip per page. Validation errors are
 * returned (not thrown) so the route can render a 422 list.
 */
export async function publishPageSnapshot(
  container: MedusaContainer,
  input: PublishPageInput
): Promise<PublishPageResult> {
  const service: CmsModuleService = container.resolve(CMS_MODULE)
  const { locale } = input
  const tenant_id = input.tenant_id ?? null

  // 1. Resolve the draft tree.
  let page = input.page
  if (!page) {
    if (!input.pageId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "publishPageSnapshot requires either `page` or `pageId`."
      )
    }
    try {
      page = await service.retrieveCmsPage(input.pageId, {
        relations: [...PUBLISH_PAGE_RELATIONS],
      })
    } catch {
      page = null
    }
    if (!page) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Page with id "${input.pageId}" was not found.`
      )
    }
  }

  // Ownership guard (pooled multi-tenant): a page may only be published by its
  // owning tenant. Fail-closed — a mismatch (or a tenant-less page under a real
  // tenant) is treated as not-found.
  if ((page.tenant_id ?? null) !== tenant_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${page.id}" was not found.`
    )
  }

  // 2. Archived pages cannot be published.
  if (page.status === "archived") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot publish an archived page. Restore it to draft/active first."
    )
  }

  // 3. en-before-bn guard: the fallback chain must always terminate at en.
  if (locale !== "en") {
    const liveEn = await service.listCmsSnapshots({
      tenant_id,
      entity_type: "page",
      slug: page.slug,
      locale: "en",
      is_live: true,
    })
    if (!liveEn?.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Publish the default locale (en) before publishing "${locale}".`
      )
    }
  }

  // 4. Compile + validate.
  const compiled = compilePageSnapshot(page, locale)
  if (!compiled.ok) {
    return { ok: false, errors: compiled.errors, page }
  }

  // 5. Persist atomically (version++, demote prior live, insert new live).
  const snapshot: any = await service.publishSnapshot({
    tenant_id,
    entity_type: "page",
    entity_id: page.id,
    slug: page.slug,
    locale,
    data: compiled.data,
    published_by: input.published_by ?? null,
    note: input.note ?? null,
  })

  // 6. Emit cms.published (best-effort, never blocks).
  if (!input.skipEvent) {
    await emitCmsPublished(container, {
      entity_type: "page",
      slug: page.slug,
      locale,
      tenant_id,
    })
  }

  return { ok: true, snapshot, page }
}
