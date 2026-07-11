import { model } from "@medusajs/framework/utils"

/**
 * marketing_keyword — a tracked search term within an SEO project.
 *
 * `term` is the phrase, `intent`/`volume`/`difficulty` describe it, and `status`
 * tracks its lifecycle (tracked, targeted, ranking). Optionally attached to a
 * MarketingSeoProject via `seo_project_id`.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. The composite
 * (tenant_id, seo_project_id) index backs per-project keyword lookups.
 */
const MarketingKeyword = model
  .define("marketing_keyword", {
    id: model.id({ prefix: "mkw" }).primaryKey(),
    tenant_id: model.text(),
    seo_project_id: model.text().nullable(),
    term: model.text(),
    intent: model.text().nullable(),
    volume: model.number().nullable(),
    difficulty: model.number().nullable(),
    status: model.enum(["tracked", "targeted", "ranking"]).default("tracked"),
  })
  .indexes([
    {
      name: "IDX_marketing_keyword_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_keyword_tenant_project",
      on: ["tenant_id", "seo_project_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingKeyword
