import { model } from "@medusajs/framework/utils"

/**
 * marketing_campaign — a themed grouping of marketing posts pursuing a shared
 * `objective` over a time window.
 *
 * Carries scheduling bounds (`starts_at` / `ends_at`), an optional product focus
 * (`product_ids`), and a `channel_mix` describing how effort is split across
 * platforms. Posts reference a campaign via their `campaign_id`.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingCampaign = model
  .define("marketing_campaign", {
    id: model.id({ prefix: "mcamp" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    objective: model.text().nullable(),
    status: model
      .enum(["draft", "active", "paused", "completed"])
      .default("draft"),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    product_ids: model.json().nullable(),
    channel_mix: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_campaign_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingCampaign
