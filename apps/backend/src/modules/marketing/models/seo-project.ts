import { model } from "@medusajs/framework/utils"

/**
 * marketing_seo_project — a named SEO workspace for a domain/locale.
 *
 * Groups keywords, content briefs and articles under one `name`, scoped to an
 * optional `domain` and `target_locale`.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingSeoProject = model
  .define("marketing_seo_project", {
    id: model.id({ prefix: "mseo" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    domain: model.text().nullable(),
    target_locale: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_seo_project_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSeoProject
