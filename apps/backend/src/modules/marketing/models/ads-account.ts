import { model } from "@medusajs/framework/utils"

/**
 * ads_account — one ad account discovered under an ads_connection (a Meta
 * `act_…`, later a Google Ads customer id / TikTok advertiser id).
 *
 * `selected` marks the accounts the merchant actually uses from the panel —
 * campaign mirroring, insight syncs, and (later) campaign creation only touch
 * selected accounts, so connecting an agency identity with 50 accounts does
 * not flood the dashboard.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsAccount = model
  .define("ads_account", {
    id: model.id({ prefix: "adacct" }).primaryKey(),
    tenant_id: model.text(),
    connection_id: model.text(),
    platform: model.enum(["meta", "google", "tiktok", "mock"]),
    external_id: model.text(),
    name: model.text().nullable(),
    currency: model.text().nullable(),
    timezone: model.text().nullable(),
    status: model.enum(["active", "disabled"]).default("active"),
    selected: model.boolean().default(false),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_account_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_account_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_account_connection_id",
      on: ["connection_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsAccount
