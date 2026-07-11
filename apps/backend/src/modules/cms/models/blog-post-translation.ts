import { model } from "@medusajs/framework/utils"
import CmsBlogPost from "./blog-post"

/**
 * cms_blog_post_translation — sparse non-default-locale override of a blog post's
 * translatable fields (Phase 8).
 *
 * One row per (post_id, locale) for NON-default locales only (`bn`). `en` needs
 * no row — its text lives on the cms_blog_post base row. Resolve rule per field:
 *   resolved = translation[field] ?? post[field]
 * so any field left null/absent here falls back to the en value. Keyed off the
 * stable post_id; cascades on post delete.
 *
 * Generated CRUD (model key CmsBlogPostTranslation):
 *   createCmsBlogPostTranslations / listCmsBlogPostTranslations /
 *   listAndCountCmsBlogPostTranslations / retrieveCmsBlogPostTranslation /
 *   updateCmsBlogPostTranslations / deleteCmsBlogPostTranslations /
 *   softDeleteCmsBlogPostTranslations / restoreCmsBlogPostTranslations
 */
const CmsBlogPostTranslation = model
  .define("cms_blog_post_translation", {
    id: model.id({ prefix: "cmsblogt" }).primaryKey(),
    // Validated app-side against LOCALES (modules/cms/types.ts), not a DB enum.
    locale: model.text(),
    title: model.text().nullable(),
    excerpt: model.text().nullable(),
    content: model.text().nullable(),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    og_image: model.text().nullable(),
    post: model.belongsTo(() => CmsBlogPost, { mappedBy: "translations" }),
  })
  .indexes([
    {
      name: "IDX_cms_blog_post_translation_post_locale_unique",
      on: ["post_id", "locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsBlogPostTranslation
