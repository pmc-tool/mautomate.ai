import { model } from "@medusajs/framework/utils"
import CmsPage from "./page"

/**
 * cms_page_translation — sparse non-default-locale override of page-level text
 * (phase-0-architecture.md §2.3).
 *
 * One row per (page_id, locale) for NON-default locales only (`bn`). `en` needs
 * no row — its text lives on the cms_page base row. Compile rule:
 *   compiled(locale) = { ...page(en fields), ...translation[locale] (non-null) }
 * Any field left null/absent here falls back to the en base value.
 *
 * Generated CRUD (model key CmsPageTranslation):
 *   createCmsPageTranslations / listCmsPageTranslations /
 *   listAndCountCmsPageTranslations / retrieveCmsPageTranslation /
 *   updateCmsPageTranslations / deleteCmsPageTranslations /
 *   softDeleteCmsPageTranslations / restoreCmsPageTranslations
 */
const CmsPageTranslation = model
  .define("cms_page_translation", {
    id: model.id({ prefix: "cmspgt" }).primaryKey(),
    // Validated app-side against LOCALES (modules/cms/types.ts), not a DB enum.
    locale: model.text(),
    title: model.text().nullable(),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    seo_keywords: model.text().nullable(),
    og_image: model.text().nullable(),
    page: model.belongsTo(() => CmsPage, { mappedBy: "translations" }),
  })
  .indexes([
    {
      name: "IDX_cms_page_translation_page_locale_unique",
      on: ["page_id", "locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsPageTranslation
