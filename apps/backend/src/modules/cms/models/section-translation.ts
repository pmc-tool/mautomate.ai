import { model } from "@medusajs/framework/utils"
import CmsSection from "./section"

/**
 * cms_section_translation — sparse non-default-locale override of a section's
 * translatable keys (phase-0-architecture.md §2.5).
 *
 * One row per (section_id, locale) for NON-default locales only (`bn`). `data`
 * is a SPARSE override of translatable keys (heading, body, alt, cta_label…).
 * Compile rule per section:
 *   deepMerge(section.data, translation[locale]?.data ?? {})
 * so any key absent here falls back to the en value in section.data. Keyed off
 * the stable section_id (never position), and cascades on section delete.
 *
 * Generated CRUD (model key CmsSectionTranslation):
 *   createCmsSectionTranslations / listCmsSectionTranslations /
 *   listAndCountCmsSectionTranslations / retrieveCmsSectionTranslation /
 *   updateCmsSectionTranslations / deleteCmsSectionTranslations /
 *   softDeleteCmsSectionTranslations / restoreCmsSectionTranslations
 */
const CmsSectionTranslation = model
  .define("cms_section_translation", {
    id: model.id({ prefix: "cmssect" }).primaryKey(),
    // Validated app-side against LOCALES (modules/cms/types.ts), not a DB enum.
    locale: model.text(),
    // Sparse override of translatable keys only.
    data: model.json(),
    section: model.belongsTo(() => CmsSection, { mappedBy: "translations" }),
  })
  .indexes([
    {
      name: "IDX_cms_section_translation_section_locale_unique",
      on: ["section_id", "locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsSectionTranslation
