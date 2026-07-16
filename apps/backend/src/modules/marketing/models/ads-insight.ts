import { model } from "@medusajs/framework/utils"

/**
 * ads_insight — one day of performance for one object (campaign now; ad set /
 * ad levels from Phase 3) on one platform. The overview dashboard aggregates
 * ONLY these stored rows — every figure a merchant sees was actually returned
 * by the platform's insights API; empty tenants report zeros, never fabricated
 * numbers.
 *
 * Money rule: `spend` and `conversion_value` are MAJOR currency units. All
 * metric columns are float (the integer-money-column lesson from the credit
 * ledger: a numeric stored into an integer column silently truncates).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsInsight = model
  .define("ads_insight", {
    id: model.id({ prefix: "adins" }).primaryKey(),
    tenant_id: model.text(),
    account_id: model.text(),
    level: model.enum(["account", "campaign", "adset", "ad"]),
    external_id: model.text(),
    date: model.dateTime(),
    currency: model.text().nullable(),
    spend: model.float().default(0),
    impressions: model.float().default(0),
    clicks: model.float().default(0),
    ctr: model.float().nullable(),
    conversions: model.float().default(0),
    conversion_value: model.float().default(0),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_insight_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_insight_tenant_level_external_date_unique",
      on: ["tenant_id", "level", "external_id", "date"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_insight_tenant_date",
      on: ["tenant_id", "date"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsInsight
