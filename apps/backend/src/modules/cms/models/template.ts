import { model } from "@medusajs/framework/utils"

/**
 * cms_template — a reusable, tenant-scoped page-builder template (Phase 7).
 * `data` holds the editor block tree (Section[]) the merchant saved; they can
 * insert it into any page. Elementor-style "Save as template" + library insert.
 *
 * Phase 4C (ARCH-UX U5): `scope` gains "preset" — a per-widget STYLE preset
 * stored on the same tenant-scoped store instead of localStorage. For presets,
 * `data` is `{ blockType, style, advanced, elementStyles }` (the appearance
 * bags, no content) and `widget_type` mirrors `data.blockType` as a real,
 * filterable column so the apply dropdown can list presets for one widget
 * type without pulling every row. NULL widget_type = applies to any type
 * (legacy localStorage entries migrated without a recorded block type).
 * The DB column for `scope` is plain text (no CHECK constraint) — the enum
 * lives at the ORM layer only, so extending it needs no column alter.
 */
const CmsTemplate = model
  .define("cms_template", {
    id: model.id({ prefix: "cmstpl" }).primaryKey(),
    tenant_id: model.text().nullable(),
    name: model.text(),
    category: model.text().default("Sections"),
    scope: model.enum(["page", "section", "preset"]).default("section"),
    widget_type: model.text().nullable(),
    data: model.json(),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_cms_template_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_template_tenant_scope",
      on: ["tenant_id", "scope"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsTemplate
