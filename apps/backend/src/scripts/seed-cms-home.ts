import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"
import { deepMerge, type Locale } from "../modules/cms/types"
import {
  heroSliderBlock,
  promoBannerGridBlock,
  schemaVersionFor,
  validateBlockData,
} from "../modules/cms/registry"
import { productTabsBlock } from "../modules/cms/registry/product-tabs"
import { dealOfDayBlock } from "../modules/cms/registry/deal-of-day"
import { categoryShowcaseBlock } from "../modules/cms/registry/category-showcase"
import { brandStripBlock } from "../modules/cms/registry/brand-strip"

/**
 * Seed / upsert the CMS "home" page (the multi-page builder read-model — Phase
 * 3) with the CURRENT live Forever Finds storefront home content, refactored
 * into two CMS blocks:
 *
 *   1. hero_slider        — the 3 slides from
 *      storefront/src/modules/home/components/learts/hero-slider.tsx
 *      (/learts/assets/images/slider/home3/slide-1..3.webp, "Handicraft shop"
 *      kickers, the three headlines with a "\n" line break, cta "shop now" ->
 *      /store).
 *   2. promo_banner_grid  — the intro blockquote, Spring-sale banner, Home
 *      Decor / Gift Ideas / Toys (wide) category tiles and the @forever_finds
 *      instagram tile from
 *      storefront/src/modules/home/components/learts/category-banners.tsx.
 *
 * Both payloads are taken VERBATIM from the block registry defaultData()
 * (modules/cms/registry/hero-slider.ts + promo-banner-grid.ts), which is the
 * single source of truth and already mirrors the current storefront values
 * 1:1. Using defaultData() here guarantees schema parity — the seeded en data
 * validates and compiles into a snapshot without drift.
 *
 * LOCALIZATION: only the en (default-locale) `section.data` is seeded. bn is
 * left EMPTY (no cms_section_translation rows) so Bengali resolves entirely
 * from en at publish/compile time. Translators populate the bn overrides later
 * via the admin section editor.
 *
 * Run with:  npx medusa exec ./src/scripts/seed-cms-home.ts
 * (DO NOT run as part of this workflow — the human integrator runs
 * migrate + seed + publish + restart.)
 *
 * IDEMPOTENT:
 *   - the page is upserted by slug ("home"): list -> update | create,
 *   - its sections are REPLACED on every run (soft-delete every existing
 *     section + its translations, then recreate the two canonical sections in
 *     rank order). Re-running always converges on exactly these two blocks.
 *
 * PUBLISH: after seeding the draft, this script ALSO compiles + publishes the
 * en snapshot (reusing the exact compile logic of the publish route) so the
 * storefront renders the CMS home immediately after a single seed run. The
 * publish step is best-effort — if it fails, the draft is still seeded and the
 * human can publish from the admin. (bn is intentionally NOT published — en
 * must be live first, and there is no bn content to compile yet.)
 */

const PAGE_SLUG = "home"
const SEED_ACTOR_ID = "system"

type CompiledSection = {
  block_type: string
  schema_version: number
  [key: string]: unknown
}

function one<T>(result: T | T[]): T {
  return Array.isArray(result) ? result[0] : result
}

/** The canonical home sections, en data straight from the registry. */
function buildSections() {
  return [
    {
      type: "hero_slider",
      label: "Hero",
      rank: 0,
      enabled: true,
      data: heroSliderBlock.defaultData() as unknown as Record<string, unknown>,
    },
    {
      type: "promo_banner_grid",
      label: "Promo Banners",
      rank: 1,
      enabled: true,
      data: promoBannerGridBlock.defaultData() as unknown as Record<
        string,
        unknown
      >,
    },
    {
      type: "product_tabs",
      label: "Product Tabs",
      rank: 2,
      enabled: true,
      data: productTabsBlock.defaultData() as unknown as Record<
        string,
        unknown
      >,
    },
    {
      type: "deal_of_day",
      label: "Deal of the Day",
      rank: 3,
      enabled: true,
      data: dealOfDayBlock.defaultData() as unknown as Record<string, unknown>,
    },
    {
      type: "category_showcase",
      label: "Category Showcase",
      rank: 4,
      enabled: true,
      data: categoryShowcaseBlock.defaultData() as unknown as Record<
        string,
        unknown
      >,
    },
    {
      type: "brand_strip",
      label: "Brand Strip",
      rank: 5,
      enabled: true,
      data: brandStripBlock.defaultData() as unknown as Record<
        string,
        unknown
      >,
    },
  ]
}

/**
 * Compile the page's enabled sections (rank order) into the immutable snapshot
 * payload for `locale`. Mirrors the publish route (api/admin/cms/pages/[id]/
 * publish/route.ts) exactly: deepMerge(section.data, translation[locale]),
 * validate each block, stamp schema_version. Returns { compiled, errors }.
 */
function compilePage(
  page: any,
  locale: Locale
): { compiled: Record<string, unknown>; errors: string[] } {
  const enabled: any[] = [...(page.sections ?? [])]
    .filter((s: any) => s.enabled !== false)
    .sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

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

  const compiled = {
    slug: page.slug,
    locale,
    resolved_locale: locale,
    sections,
    seo: {
      title: page.seo_title ?? null,
      description: page.seo_description ?? null,
      keywords: page.seo_keywords ?? null,
      og_image: page.og_image ?? null,
      canonical_url: page.canonical_url ?? null,
    },
    meta: {
      entity_type: "page",
      entity_id: page.id,
      title: page.title,
      is_home: page.is_home === true,
      compiled_at: new Date().toISOString(),
    },
  }

  return { compiled, errors }
}

export default async function seedCmsHome({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cmsService = container.resolve<CmsModuleService>(CMS_MODULE)

  logger.info(
    '[cms] Seeding "home" page (hero_slider + promo_banner_grid + product_tabs + deal_of_day + category_showcase + brand_strip)...'
  )

  /* ------------------------------------------------------------------ */
  /* 1. Upsert the page by slug.                                         */
  /* ------------------------------------------------------------------ */
  const existingPages = await cmsService.listCmsPages({ slug: PAGE_SLUG })
  let page: any = existingPages?.[0] ?? null

  const pageFields = {
    slug: PAGE_SLUG,
    title: "Home",
    is_home: true,
    status: "active" as const,
    default_locale: "en",
    fallback_locale: "en",
  }

  if (page) {
    page = one(
      await cmsService.updateCmsPages({ id: page.id, ...pageFields })
    )
    logger.info(`[cms]   updated page "${PAGE_SLUG}" (${page.id})`)
  } else {
    page = one(await cmsService.createCmsPages(pageFields))
    logger.info(`[cms]   created page "${PAGE_SLUG}" (${page.id})`)
  }

  /* ------------------------------------------------------------------ */
  /* 2. Replace sections (idempotent): soft-delete existing, recreate.   */
  /* ------------------------------------------------------------------ */
  const oldSections = await cmsService.listCmsSections(
    { page_id: page.id },
    { relations: ["translations"] }
  )

  if (oldSections?.length) {
    const oldTranslationIds = oldSections
      .flatMap((s: any) => s.translations ?? [])
      .map((t: any) => t.id)
    if (oldTranslationIds.length) {
      await cmsService.softDeleteCmsSectionTranslations(oldTranslationIds)
    }
    await cmsService.softDeleteCmsSections(
      oldSections.map((s: any) => s.id)
    )
    logger.info(
      `[cms]   replaced ${oldSections.length} existing section(s) on "${PAGE_SLUG}"`
    )
  }

  for (const section of buildSections()) {
    const created = one(
      await cmsService.createCmsSections({
        page_id: page.id,
        type: section.type,
        rank: section.rank,
        enabled: section.enabled,
        label: section.label,
        data: section.data,
      })
    )
    logger.info(
      `[cms]   created section "${section.type}" rank=${section.rank} (${created.id})`
    )
  }

  /* ------------------------------------------------------------------ */
  /* 3. Audit (best-effort, non-blocking).                               */
  /* ------------------------------------------------------------------ */
  try {
    await cmsService.createCmsAuditLogs({
      actor_id: SEED_ACTOR_ID,
      actor_email: null,
      action: "page.update",
      entity_type: "page",
      entity_key: page.id,
      before: null,
      after: {
        slug: PAGE_SLUG,
        is_home: true,
        sections: buildSections().length,
      },
    })
  } catch (e) {
    logger.warn(
      `[cms]   audit log write failed (non-blocking): ${
        (e as Error)?.message ?? e
      }`
    )
  }

  /* ------------------------------------------------------------------ */
  /* 4. Compile + publish the en snapshot so the storefront shows it     */
  /*    immediately (reuses the publish-route compile logic).            */
  /* ------------------------------------------------------------------ */
  try {
    const fullPage: any = await cmsService.retrieveCmsPage(page.id, {
      relations: ["translations", "sections", "sections.translations"],
    })

    const { compiled, errors } = compilePage(fullPage, "en")

    if (errors.length) {
      logger.warn(
        `[cms]   NOT publishing — ${errors.length} block validation error(s):\n` +
          errors.map((e) => `    - ${e}`).join("\n")
      )
    } else {
      const snapshot: any = await cmsService.publishSnapshot({
        tenant_id: fullPage.tenant_id ?? null,
        entity_type: "page",
        entity_id: fullPage.id,
        slug: fullPage.slug,
        locale: "en",
        data: compiled,
        published_by: SEED_ACTOR_ID,
        note: "Seeded home page (en)",
      })

      try {
        await cmsService.createCmsAuditLogs({
          actor_id: SEED_ACTOR_ID,
          actor_email: null,
          action: "page.publish",
          entity_type: "page",
          entity_key: fullPage.id,
          before: null,
          after: {
            snapshot_id: snapshot.id,
            version: snapshot.version,
            slug: fullPage.slug,
            locale: "en",
          },
        })
      } catch {
        // non-blocking
      }

      logger.info(
        `[cms]   published en snapshot v${snapshot.version} (${snapshot.id}) — is_live=${snapshot.is_live}`
      )
    }
  } catch (e) {
    logger.warn(
      `[cms]   publish step failed (non-blocking — draft is still seeded, publish from admin): ${
        (e as Error)?.message ?? e
      }`
    )
  }

  logger.info('[cms] Home page seed complete.')
}
