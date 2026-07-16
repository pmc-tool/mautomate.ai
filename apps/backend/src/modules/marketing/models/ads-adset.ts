import { model } from "@medusajs/framework/utils"

/**
 * ads_adset — mirror of one ad set / ad group under an ads_campaign. Populated
 * from Phase 3 (campaign lifecycle); the table ships with the foundation so the
 * schema is stable before writes begin.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsAdset = model
  .define("ads_adset", {
    id: model.id({ prefix: "adset" }).primaryKey(),
    tenant_id: model.text(),
    campaign_id: model.text(),
    external_id: model.text().nullable(),
    name: model.text().nullable(),
    status: model.text().default("other"),
    external_status: model.text().nullable(),
    daily_budget: model.float().nullable(),
    targeting: model.json().nullable(),
    optimization_goal: model.text().nullable(),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_adset_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_adset_campaign_id",
      on: ["campaign_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsAdset
