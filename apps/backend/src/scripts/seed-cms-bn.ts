import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"
import {
  DEFAULT_SETTINGS,
  deepMerge,
  type DeepPartial,
  type FooterSettings,
  type Locale,
  type LocaleMap,
  type SettingDataMap,
  type TopbarSettings,
} from "../modules/cms/types"
import { schemaVersionFor, validateBlockData } from "../modules/cms/registry"

/**
 * Seed Bengali (bn) CMS translations so switching the storefront locale from
 * `en` to `bn` VISIBLY changes content, then publishes the bn home snapshot.
 *
 * Run with:  npx medusa exec ./src/scripts/seed-cms-bn.ts
 * (DO NOT run as part of this workflow — the human integrator runs
 * migrate + seed + publish + restart. Run AFTER seed-cms-settings + seed-cms-home,
 * because the bn home publish requires a LIVE en snapshot — the en-before-bn
 * guard mirrors api/admin/cms/pages/[id]/publish/route.ts.)
 *
 * WHAT IT WRITES (all idempotent):
 *   1. topbar setting — sets data.bn.message (Bengali). `en` preserved.
 *   2. footer setting — sets data.bn.newsletter.title + data.bn.copyright
 *      (Bengali, sparse). Every other footer field falls back to `en`.
 *   3. home page hero_slider section — upserts a cms_section_translation row
 *      (locale "bn") overriding each slide's title/subtitle/cta.label. Because
 *      deepMerge replaces arrays WHOLESALE, the full `slides` array is supplied
 *      with the en `image` + `cta.href` kept verbatim (locale-invariant).
 *   4. home page promo_banner_grid section — upserts a cms_section_translation
 *      row (locale "bn") overriding intro.title + intro.body. `intro` is a plain
 *      object so the merge is per-field; link_label/href fall back to en.
 *   5. Publishes the bn home snapshot (same compile pipeline as the publish
 *      route) so /store/cms/pages/home?locale=bn returns Bengali.
 *
 * SHAPE CONTRACTS (matched EXACTLY):
 *   - settings: cms_setting.data is a TOP-LEVEL locale map
 *       { en: <FullFlatSettings>, bn?: DeepPartial<FullFlatSettings> }
 *     (NOT per-field maps). bn is a sparse override resolved at read time via
 *     resolveSetting -> deepMerge(DEFAULT_SETTINGS, data.en, data.bn).
 *   - sections: cms_section_translation { section_id, locale:"bn", data } where
 *     `data` is a SPARSE override of translatable keys only; the compile does
 *     deepMerge(section.data, translation.bn.data).
 */

const PAGE_SLUG = "home"
const SEED_ACTOR_ID = "system"
const BN: Locale = "bn"

type CompiledSection = {
  block_type: string
  schema_version: number
  [key: string]: unknown
}

function one<T>(result: T | T[]): T {
  return Array.isArray(result) ? result[0] : result
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/* ------------------------------------------------------------------ */
/* Bengali content                                                     */
/* ------------------------------------------------------------------ */

const TOPBAR_BN: DeepPartial<TopbarSettings> = {
  message: "৩০০০ টাকার বেশি অর্ডারে ফ্রি ডেলিভারি!",
}

const FOOTER_BN: DeepPartial<FooterSettings> = {
  newsletter: { title: "আমাদের নিউজলেটার সাবস্ক্রাইব করুন" },
  copyright: "© {year} ফরএভার ফাইন্ডস। সর্বস্বত্ব সংরক্ষিত।",
}

/**
 * hero_slider bn override. Arrays are replaced wholesale on merge, so the FULL
 * slides array is supplied — `image` + `cta.href` are the en values verbatim
 * (locale-invariant); only title/subtitle/cta.label are Bengali.
 */
const HERO_SLIDER_BN = {
  slides: [
    {
      image: "/learts/assets/images/slider/home3/slide-1.webp",
      subtitle: "হস্তশিল্পের দোকান",
      title: "আপনার মধুরতম\nস্বপ্ন থেকে অনুপ্রাণিত",
      cta: { label: "এখনই কিনুন", href: "/store" },
    },
    {
      image: "/learts/assets/images/slider/home3/slide-2.webp",
      subtitle: "হস্তশিল্পের দোকান",
      title: "আপনার স্বাস্থ্যের জন্য\nপ্রতিদিনের রেসিপি",
      cta: { label: "এখনই কিনুন", href: "/store" },
    },
    {
      image: "/learts/assets/images/slider/home3/slide-3.webp",
      subtitle: "হস্তশিল্পের দোকান",
      title: "নতুন আকাঙ্ক্ষার জন্য\nসাজসজ্জার বাক্স",
      cta: { label: "এখনই কিনুন", href: "/store" },
    },
  ],
}

/**
 * promo_banner_grid bn override. `intro` is a plain object → per-field merge, so
 * only title + body are supplied; link_label/href fall back to the en values.
 */
const PROMO_BANNER_GRID_BN = {
  intro: {
    title:
      "ফরএভার ফাইন্ডস হলো যুক্তরাষ্ট্রভিত্তিক হস্তশিল্প ও শিল্পকর্মের একটি অনলাইন দোকান।",
    body: "নিজের হাতে এবং কিছু দরকারি সরঞ্জামের সাহায্যে সুন্দর জিনিস তৈরি করা এক চমৎকার প্রক্রিয়া, যেখানে আপনি কিছু ভাবনা ফুটিয়ে তুলতে তুলতে নিজের কাজ নিখুঁত করার আনন্দ উপভোগ করতে পারেন। আমরা উন্নতমানের অনন্য ফুলদানি, ওয়াল আর্ট, ঘর সাজানোর সামগ্রী এবং আসবাবপত্র সরবরাহ করি।",
  },
}

/* ------------------------------------------------------------------ */
/* Settings upsert (preserve en, set sparse bn)                        */
/* ------------------------------------------------------------------ */

async function upsertSettingBn<K extends "topbar" | "footer">(
  cmsService: CmsModuleService,
  logger: { info: (m: string) => void },
  key: K,
  bnOverride: DeepPartial<SettingDataMap[K]>
) {
  const existingRows = await cmsService.listCmsSettings({ key })
  const existing = (existingRows?.[0] as any) ?? null

  // Preserve whatever en already exists; fall back to DEFAULT_SETTINGS when the
  // row is somehow missing so the bn override always has a complete en sibling.
  const prevData = (existing?.data as Partial<LocaleMap<SettingDataMap[K]>>) ?? {}
  const en = (prevData.en as SettingDataMap[K]) ?? clone(DEFAULT_SETTINGS[key])

  // Merge the bn override OVER any existing bn so a re-run is additive/stable.
  const prevBn = (prevData.bn as DeepPartial<SettingDataMap[K]>) ?? {}
  const mergedBn = deepMerge(
    clone(prevBn) as SettingDataMap[K],
    bnOverride
  ) as DeepPartial<SettingDataMap[K]>

  const data: LocaleMap<SettingDataMap[K]> = { en, bn: mergedBn }
  const before = existing?.data ?? null

  if (existing) {
    await cmsService.updateCmsSettings({ id: existing.id, data })
    logger.info(`[cms]   updated "${key}" bn override`)
  } else {
    await cmsService.createCmsSettings({ key, data })
    logger.info(`[cms]   created "${key}" with bn override`)
  }

  try {
    await cmsService.createCmsAuditLogs({
      actor_id: SEED_ACTOR_ID,
      actor_email: null,
      action: existing ? "setting.update" : "setting.create",
      entity_type: "global_setting",
      entity_key: key,
      before,
      after: data,
    })
  } catch {
    // non-blocking
  }
}

/* ------------------------------------------------------------------ */
/* Section-translation upsert (sparse bn override)                     */
/* ------------------------------------------------------------------ */

async function upsertSectionTranslationBn(
  cmsService: CmsModuleService,
  logger: { info: (m: string) => void; warn: (m: string) => void },
  sectionId: string,
  data: Record<string, unknown>
) {
  const existingRows = await cmsService.listCmsSectionTranslations({
    section_id: sectionId,
    locale: BN,
  })
  const existing = (existingRows?.[0] as any) ?? null

  if (existing) {
    await cmsService.updateCmsSectionTranslations({ id: existing.id, data })
    logger.info(`[cms]   updated bn translation for section ${sectionId}`)
  } else {
    await cmsService.createCmsSectionTranslations({
      section_id: sectionId,
      locale: BN,
      data,
    })
    logger.info(`[cms]   created bn translation for section ${sectionId}`)
  }
}

/* ------------------------------------------------------------------ */
/* Compile (mirrors the publish route exactly, for locale bn)          */
/* ------------------------------------------------------------------ */

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
    seo: resolveSeo(page, locale),
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

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export default async function seedCmsBn({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cmsService = container.resolve<CmsModuleService>(CMS_MODULE)

  logger.info("[cms] Seeding Bengali (bn) translations...")

  /* 1 + 2. Settings bn overrides. */
  await upsertSettingBn(cmsService, logger, "topbar", TOPBAR_BN)
  await upsertSettingBn(cmsService, logger, "footer", FOOTER_BN)

  /* 3 + 4. Home section bn translations. */
  const pages = await cmsService.listCmsPages({ slug: PAGE_SLUG })
  const page: any = pages?.[0] ?? null
  if (!page) {
    logger.warn(
      `[cms]   page "${PAGE_SLUG}" not found — run seed-cms-home first. Skipping section + publish.`
    )
    logger.info("[cms] Bengali seed complete (settings only).")
    return
  }

  const sections = await cmsService.listCmsSections({ page_id: page.id })
  const heroSection = (sections ?? []).find(
    (s: any) => s.type === "hero_slider"
  )
  const promoSection = (sections ?? []).find(
    (s: any) => s.type === "promo_banner_grid"
  )

  if (heroSection) {
    await upsertSectionTranslationBn(
      cmsService,
      logger,
      heroSection.id,
      clone(HERO_SLIDER_BN)
    )
  } else {
    logger.warn('[cms]   no "hero_slider" section found — skipped.')
  }

  if (promoSection) {
    await upsertSectionTranslationBn(
      cmsService,
      logger,
      promoSection.id,
      clone(PROMO_BANNER_GRID_BN)
    )
  } else {
    logger.warn('[cms]   no "promo_banner_grid" section found — skipped.')
  }

  /* 5. Publish the bn home snapshot (en-before-bn guard, then compile). */
  try {
    const liveEn = await cmsService.listCmsSnapshots({
      entity_type: "page",
      slug: page.slug,
      locale: "en",
      is_live: true,
    })
    if (!liveEn?.length) {
      logger.warn(
        `[cms]   NOT publishing bn — no live en snapshot for "${page.slug}". ` +
          "Run seed-cms-home (or publish en from admin) first, then re-run this seed."
      )
      logger.info("[cms] Bengali seed complete (no bn publish).")
      return
    }

    const fullPage: any = await cmsService.retrieveCmsPage(page.id, {
      relations: ["translations", "sections", "sections.translations"],
    })

    const { compiled, errors } = compilePage(fullPage, BN)
    if (errors.length) {
      logger.warn(
        `[cms]   NOT publishing bn — ${errors.length} block validation error(s):\n` +
          errors.map((e) => `    - ${e}`).join("\n")
      )
      logger.info("[cms] Bengali seed complete (bn publish skipped — invalid).")
      return
    }

    const snapshot: any = await cmsService.publishSnapshot({
      tenant_id: fullPage.tenant_id ?? null,
      entity_type: "page",
      entity_id: fullPage.id,
      slug: fullPage.slug,
      locale: BN,
      data: compiled,
      published_by: SEED_ACTOR_ID,
      note: "Seeded home page (bn)",
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
          locale: BN,
        },
      })
    } catch {
      // non-blocking
    }

    logger.info(
      `[cms]   published bn snapshot v${snapshot.version} (${snapshot.id}) — is_live=${snapshot.is_live}`
    )
  } catch (e) {
    logger.warn(
      `[cms]   bn publish step failed (non-blocking — drafts/translations still seeded): ${
        (e as Error)?.message ?? e
      }`
    )
  }

  logger.info("[cms] Bengali seed complete.")
}
