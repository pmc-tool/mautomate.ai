import { model } from "@medusajs/framework/utils"
import CmsSection from "./section"
import CmsPageTranslation from "./page-translation"

/**
 * cms_page — page container + DRAFT root (phase-0-architecture.md §2.2).
 *
 * Holds locale-invariant structure plus the full default-locale (`en`) text:
 * title + SEO live as typed columns here; non-default-locale overrides live in
 * cms_page_translation rows. Ordered `sections` (cms_section) compose the page
 * body. PUBLISH compiles this draft tree into an immutable cms_snapshot per
 * locale.
 *
 * `status` is the editorial container state only — `archived` ⇒ the store API
 * 404s for every locale. (Per-locale publish lifecycle is tracked separately by
 * the snapshot `is_live` flag in Phase 3; the doc's cms_locale_status arrives in
 * a later phase.)
 *
 * Generated CRUD (model key CmsPage):
 *   createCmsPages / listCmsPages / listAndCountCmsPages / retrieveCmsPage /
 *   updateCmsPages / deleteCmsPages / softDeleteCmsPages / restoreCmsPages
 */
const CmsPage = model
  .define("cms_page", {
    id: model.id({ prefix: "cmspage" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Unique route slug (enforced by the partial index below). "home" is the
    // is_home page; the store read API keys off this slug.
    slug: model.text(),
    // Default-locale (en) page title.
    title: model.text().searchable(),
    // Editorial container state. `archived` ⇒ store API 404 for all locales.
    status: model
      .enum(["draft", "active", "archived"])
      .default("draft"),
    // The `/` route page. At most one should be true (app-enforced).
    is_home: model.boolean().default(false),
    default_locale: model.text().default("en"),
    // Read-time fallback target when a requested locale has no live snapshot.
    fallback_locale: model.text().default("en"),
    // Default-locale SEO fields. Per-locale overrides live in the translation row.
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    seo_keywords: model.text().nullable(),
    og_image: model.text().nullable(),
    canonical_url: model.text().nullable(),
    // Scheduled-publish trigger (phase-6). When set and in the past, the
    // `cms-scheduled-publish` job compiles + publishes the page (default locale),
    // then clears this column back to null. Null ⇒ not scheduled.
    scheduled_at: model.dateTime().nullable(),
    sections: model.hasMany(() => CmsSection, { mappedBy: "page" }),
    translations: model.hasMany(() => CmsPageTranslation, {
      mappedBy: "page",
    }),
  })
  .indexes([
    {
      name: "IDX_cms_page_tenant_slug_unique",
      on: ["tenant_id", "slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_page_status",
      on: ["status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Speeds up the scheduled-publish job's "due pages" sweep.
      name: "IDX_cms_page_scheduled_at",
      on: ["scheduled_at"],
      unique: false,
      where: "deleted_at IS NULL AND scheduled_at IS NOT NULL",
    },
  ])

export default CmsPage
