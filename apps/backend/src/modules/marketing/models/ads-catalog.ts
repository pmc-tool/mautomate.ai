import { model } from "@medusajs/framework/utils"

/**
 * ads_catalog — the tenant's product catalog on an ad platform (Meta Commerce
 * catalog now, later Google Merchant Center / TikTok catalog). Holds the
 * remote catalog id plus honest sync bookkeeping (item_count is what we
 * actually pushed, skipped_count what the feed builder had to leave out and
 * why the merchant should fix those products).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsCatalog = model
  .define("ads_catalog", {
    id: model.id({ prefix: "adcat" }).primaryKey(),
    tenant_id: model.text(),
    connection_id: model.text().nullable(),
    platform: model.enum(["meta", "google", "tiktok", "mock"]),
    external_id: model.text(),
    business_id: model.text().nullable(),
    name: model.text().nullable(),
    status: model.enum(["active", "error"]).default("active"),
    item_count: model.float().default(0),
    skipped_count: model.float().default(0),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_catalog_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_catalog_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsCatalog
