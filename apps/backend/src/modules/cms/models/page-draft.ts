import { model } from "@medusajs/framework/utils"

/**
 * cms_page_draft — the visual editor's AUTOSAVE BUFFER (Phase 1).
 *
 * One row per (tenant_id, slug, locale) holding the editor's current Puck data
 * ({ root, content }). The editor autosaves here continuously and independently
 * of Publish, so a merchant can never lose work to a tab crash, a network drop,
 * or a failed publish. The editor loads this draft (when present) in preference
 * to the live snapshot; a successful Publish clears it.
 *
 * Additive + non-destructive: the live `cms_snapshot` rendering path is
 * untouched — the storefront still serves published snapshots only.
 */
const CmsPageDraft = model
  .define("cms_page_draft", {
    id: model.id({ prefix: "cmsdraft" }).primaryKey(),
    tenant_id: model.text().nullable(),
    slug: model.text(),
    locale: model.text().default("en"),
    // Puck editor data: { root, content: [...] }.
    data: model.json(),
    updated_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_cms_page_draft_tenant_slug_locale",
      on: ["tenant_id", "slug", "locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsPageDraft
