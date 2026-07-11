import { model } from "@medusajs/framework/utils"

/**
 * cms_template — a reusable, tenant-scoped page-builder template (Phase 7).
 * `data` holds the editor block tree (Section[]) the merchant saved; they can
 * insert it into any page. Elementor-style "Save as template" + library insert.
 */
const CmsTemplate = model
  .define("cms_template", {
    id: model.id({ prefix: "cmstpl" }).primaryKey(),
    tenant_id: model.text().nullable(),
    name: model.text(),
    category: model.text().default("Sections"),
    scope: model.enum(["page", "section"]).default("section"),
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
  ])

export default CmsTemplate
