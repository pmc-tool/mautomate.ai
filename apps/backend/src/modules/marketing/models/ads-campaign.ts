import { model } from "@medusajs/framework/utils"

/**
 * ads_campaign — the local mirror of one ad campaign on a platform, plus (from
 * Phase 3) the panel's own campaigns before/while they exist remotely.
 *
 * `source` records provenance: `imported` rows mirror campaigns that already
 * existed on the platform; `panel` rows were created from the wizard; `ai` rows
 * were drafted by the AI layer. Mirrored fields are refreshed by the sync
 * sweep; `status` is the normalized lifecycle value the UI reasons about while
 * `external_status` preserves the platform's raw value (e.g. Meta
 * effective_status) untouched.
 *
 * Money rule: budgets are stored in MAJOR currency units (platform minor-unit
 * amounts are converted at the adapter boundary).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsCampaign = model
  .define("ads_campaign", {
    id: model.id({ prefix: "adcamp" }).primaryKey(),
    tenant_id: model.text(),
    account_id: model.text(),
    platform: model.enum(["meta", "google", "tiktok", "mock"]),
    external_id: model.text().nullable(),
    name: model.text(),
    objective: model.text().nullable(),
    status: model.text().default("other"),
    external_status: model.text().nullable(),
    source: model.enum(["imported", "panel", "ai"]).default("imported"),
    daily_budget: model.float().nullable(),
    lifetime_budget: model.float().nullable(),
    currency: model.text().nullable(),
    start_at: model.dateTime().nullable(),
    end_at: model.dateTime().nullable(),
    spec: model.json().nullable(),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_campaign_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_campaign_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_id"],
      unique: true,
      where: "deleted_at IS NULL AND external_id IS NOT NULL",
    },
    {
      name: "IDX_ads_campaign_account_id",
      on: ["account_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsCampaign
