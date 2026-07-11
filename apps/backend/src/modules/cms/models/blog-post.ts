import { model } from "@medusajs/framework/utils"
import CmsAuthor from "./author"
import CmsBlogCategory from "./blog-category"
import CmsBlogPostTranslation from "./blog-post-translation"

/**
 * cms_blog_post — a blog article (Phase 8).
 *
 * Holds the full DEFAULT-locale (`en`) content as typed columns (title, excerpt,
 * content [rich HTML], cover_image, SEO). Non-default-locale overrides live in
 * cms_blog_post_translation rows keyed off post_id (sparse — any absent field
 * falls back to the en value here), mirroring the section/page translation model.
 *
 * Publishing is status-based (NOT snapshot-compiled like pages): the store read
 * API serves rows with `status = "published"` directly, resolved to the requested
 * locale at read time. A publish flips `status` -> "published", stamps
 * `published_at`, and emits `cms.published` (entity_type "blog_post") so the
 * storefront revalidates the `cms-blog` + `cms-blog-post-<slug>` tags.
 *
 * `scheduled_at` (when set, in the future) defers the publish to the
 * `cms-scheduled-publish` job, which claims due rows and publishes them with the
 * exact same pipeline as the admin publish route.
 *
 * Generated CRUD (model key CmsBlogPost):
 *   createCmsBlogPosts / listCmsBlogPosts / listAndCountCmsBlogPosts /
 *   retrieveCmsBlogPost / updateCmsBlogPosts / deleteCmsBlogPosts /
 *   softDeleteCmsBlogPosts / restoreCmsBlogPosts
 */
const CmsBlogPost = model
  .define("cms_blog_post", {
    id: model.id({ prefix: "cmsblog" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Unique route slug (enforced by the partial index below).
    slug: model.text(),
    // Default-locale (en) title.
    title: model.text().searchable(),
    // Short summary shown on listing cards / meta description fallback.
    excerpt: model.text().nullable(),
    // Full article body as rich HTML (sanitized at render time on the storefront).
    content: model.text().nullable(),
    // Cover/hero image URL (cms_media URL or absolute).
    cover_image: model.text().nullable(),
    // Editorial publish state. `published` ⇒ visible on the store read API.
    status: model.enum(["draft", "published"]).default("draft"),
    // When the post went live (null until first published). Used for ordering
    // the listing (newest first) and the RSS/sitemap lastmod.
    published_at: model.dateTime().nullable(),
    // Scheduled-publish trigger. When set and in the past, the
    // `cms-scheduled-publish` job publishes the post then clears this column.
    scheduled_at: model.dateTime().nullable(),
    // Default-locale SEO overrides (fall back to title/excerpt/cover_image).
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    og_image: model.text().nullable(),
    // Estimated reading time in minutes (optional; computed at create/update).
    reading_time: model.number().nullable(),
    // Author byline (nullable — a post may be unattributed).
    author: model.belongsTo(() => CmsAuthor, { mappedBy: "posts" }).nullable(),
    // Categories (manyToMany — auto-managed join table, no extra pivot columns).
    categories: model.manyToMany(() => CmsBlogCategory, {
      mappedBy: "posts",
      pivotTable: "cms_blog_post_category",
    }),
    // Non-default-locale text overrides (sparse).
    translations: model.hasMany(() => CmsBlogPostTranslation, {
      mappedBy: "post",
    }),
  })
  .cascades({
    // Removing a post drops its translation rows; categories/author detach only.
    delete: ["translations"],
    detach: ["categories"],
  })
  .indexes([
    {
      name: "IDX_cms_blog_post_tenant_slug_unique",
      on: ["tenant_id", "slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_blog_post_status",
      on: ["status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_blog_post_published_at",
      on: ["published_at"],
      unique: false,
      where: "deleted_at IS NULL AND published_at IS NOT NULL",
    },
    {
      // Speeds up the scheduled-publish job's "due posts" sweep.
      name: "IDX_cms_blog_post_scheduled_at",
      on: ["scheduled_at"],
      unique: false,
      where: "deleted_at IS NULL AND scheduled_at IS NOT NULL",
    },
  ])

export default CmsBlogPost
