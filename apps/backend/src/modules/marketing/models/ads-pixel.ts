import { model } from "@medusajs/framework/utils"

/**
 * ads_pixel — the tenant's tracking pixel / dataset on an ad platform (Meta
 * Pixel now, later Google enhanced conversions / TikTok events). One active
 * row per tenant per platform.
 *
 * `external_id` is the platform pixel id — it is PUBLIC by design (it ships in
 * every storefront page), so it travels the tenant-config path un-encrypted.
 * Server-side Conversions API calls authenticate with the ads_connection's
 * sealed token; `capi_token_enc` is reserved for a dedicated system-user token
 * later. `events_sent`/`last_event_at` give the dashboard an honest CAPI
 * heartbeat.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsPixel = model
  .define("ads_pixel", {
    id: model.id({ prefix: "adpix" }).primaryKey(),
    tenant_id: model.text(),
    connection_id: model.text().nullable(),
    account_id: model.text().nullable(),
    platform: model.enum(["meta", "google", "tiktok", "mock"]),
    external_id: model.text(),
    name: model.text().nullable(),
    capi_token_enc: model.text().nullable(),
    test_event_code: model.text().nullable(),
    status: model.enum(["active", "disabled"]).default("active"),
    events_sent: model.float().default(0),
    last_event_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_pixel_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_pixel_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsPixel
