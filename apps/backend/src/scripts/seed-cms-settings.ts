import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type DeepPartial,
  type LocaleMap,
  type SettingDataMap,
  type SettingKey,
} from "../modules/cms/types"

/**
 * Seed / upsert the 5 global CMS settings singletons with the CURRENT live
 * Forever Finds storefront values (Phase 1: header / topbar / footer / theme /
 * seo_defaults).
 *
 * Run with:  npx medusa exec ./src/scripts/seed-cms-settings.ts
 * (DO NOT run as part of this workflow — the human integrator runs migrate+seed.)
 *
 * STORAGE CONTRACT (the settings localization exception — see
 * modules/cms/types.ts + phase-0-architecture.md §2.6/§11.1):
 *   cms_setting.data is a TOP-LEVEL LOCALE MAP, NOT per-field maps:
 *       { en: <FullFlatSettings>, bn?: DeepPartial<FullFlatSettings> }
 *   `en` is always the complete object; `bn` is a sparse override. We seed
 *   `bn` as {} (empty) so every Bengali field falls back to `en` at read time
 *   via resolveSetting -> deepMerge(DEFAULT_SETTINGS[key], data.en, data[locale]).
 *
 * Idempotent: upsert by `key` (listCmsSettings -> update | create). Safe to
 * re-run; it overwrites each singleton's data with the canonical seed below.
 */

/**
 * The seeded `en` object per key. Based verbatim on DEFAULT_SETTINGS (the
 * inline store-API fallback) to guarantee shape parity, with the explicit
 * seed-builder overrides applied on top (currently only the SEO marketing
 * title, which is intentionally longer than the short brand-name fallback).
 */
const SEED_EN: { [K in SettingKey]: SettingDataMap[K] } = {
  topbar: clone(DEFAULT_SETTINGS.topbar),
  header: clone(DEFAULT_SETTINGS.header),
  footer: clone(DEFAULT_SETTINGS.footer),
  theme: clone(DEFAULT_SETTINGS.theme),
  seo_defaults: {
    ...clone(DEFAULT_SETTINGS.seo_defaults),
    // Explicit seed-builder value — the live storefront SEO title is the
    // marketing form; DEFAULT_SETTINGS keeps the short "Forever Finds" brand
    // name as the code-level missing-row fallback.
    title: "Forever Finds – Handmade & Gifts Shop",
  },
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Build the stored locale-map wrapper for a key: full `en`, empty `bn`. */
function buildData<K extends SettingKey>(key: K): LocaleMap<SettingDataMap[K]> {
  return {
    en: SEED_EN[key],
    // Empty sparse override — Bengali resolves entirely from `en`. Translators
    // populate this later; arrays are replaced wholesale on override.
    bn: {} as DeepPartial<SettingDataMap[K]>,
  }
}

export default async function seedCmsSettings({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cmsService = container.resolve<CmsModuleService>(CMS_MODULE)

  logger.info("[cms] Seeding global settings singletons...")

  let created = 0
  let updated = 0

  for (const key of SETTING_KEYS) {
    const data = buildData(key)

    // Upsert by key (singleton). The unique partial index on `key` guarantees
    // at most one live row per key.
    const existingRows = await cmsService.listCmsSettings({ key })
    const existing = (existingRows?.[0] as any) ?? null
    const before = existing?.data ?? null

    if (existing) {
      await cmsService.updateCmsSettings({ id: existing.id, data })
      updated++
      logger.info(`[cms]   updated "${key}"`)
    } else {
      await cmsService.createCmsSettings({ key, data })
      created++
      logger.info(`[cms]   created "${key}"`)
    }

    // Audit trail (best-effort, non-blocking) — every settings WRITE records a
    // row. The seed actor is the synthetic "system" identity.
    try {
      await cmsService.createCmsAuditLogs({
        actor_id: "system",
        actor_email: null,
        action: existing ? "setting.update" : "setting.create",
        entity_type: "global_setting",
        entity_key: key,
        before,
        after: data,
      })
    } catch (e) {
      logger.warn(
        `[cms]   audit log write failed for "${key}" (non-blocking): ${
          (e as Error)?.message ?? e
        }`
      )
    }
  }

  logger.info(
    `[cms] Settings seed complete — ${created} created, ${updated} updated (${SETTING_KEYS.length} total).`
  )
}
