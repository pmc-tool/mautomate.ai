import { model } from "@medusajs/framework/utils"

/**
 * cms_snapshot — immutable, versioned, locale-resolved published read model
 * (phase-0-architecture.md §2.7).
 *
 * PUBLISH(locale) compiles the draft tree (page + enabled sections in rank
 * order, deep-merged with the locale translation) into ONE row's `data`, sets
 * `is_live=true`, bumps `version`, and flips the prior live row to
 * `is_live=false` — all inside a single transaction (Builder B owns the publish
 * route). The store read API serves exactly the one `is_live` row per
 * (entity_type, slug, locale) — the O(1) hot path. All versions for a key are
 * the revision history.
 *
 * `slug` is denormalized onto the snapshot so the store read API can fetch by
 * (slug, locale) without joining back to cms_page. For global settings,
 * entity_type="global" and slug == entity_id == the setting key.
 *
 * Generated CRUD (model key CmsSnapshot):
 *   createCmsSnapshots / listCmsSnapshots / listAndCountCmsSnapshots /
 *   retrieveCmsSnapshot / updateCmsSnapshots / deleteCmsSnapshots /
 *   softDeleteCmsSnapshots / restoreCmsSnapshots
 */
const CmsSnapshot = model
  .define("cms_snapshot", {
    id: model.id({ prefix: "cmssnap" }).primaryKey(),
    tenant_id: model.text().nullable(),
    entity_type: model.enum(["page", "global"]),
    // page_id (for pages) or setting key (for globals).
    entity_id: model.text(),
    // Denormalized route slug (== entity_id/key for globals) for O(1) store read.
    slug: model.text(),
    // Validated app-side against LOCALES.
    locale: model.text(),
    // Monotonic per (entity_type, slug, locale).
    version: model.number().default(1),
    // Hot-read flag — exactly one live row per (entity_type, slug, locale).
    is_live: model.boolean().default(false),
    // Fully compiled, locale-resolved, immutable published payload.
    data: model.json(),
    published_by: model.text().nullable(),
    published_at: model.dateTime().nullable(),
    // Optional changelog/revision label.
    note: model.text().nullable(),
  })
  .indexes([
    {
      // DB-enforces a single live row per (entity, slug, locale): a publish race
      // fails loudly instead of corrupting reads.
      name: "IDX_cms_snapshot_tenant_live_unique",
      on: ["tenant_id", "entity_type", "slug", "locale"],
      unique: true,
      where: "is_live = true AND deleted_at IS NULL",
    },
    {
      // Append-only version history: one row per version per key.
      name: "IDX_cms_snapshot_tenant_version_unique",
      on: ["tenant_id", "entity_type", "slug", "locale", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsSnapshot
