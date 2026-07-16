import { model } from "@medusajs/framework/utils"

/**
 * ads_ad — mirror of one ad (creative + destination) under an ads_adset.
 * Populated from Phase 3; `creative` holds the preview payload the panel shows
 * (image url, headline, primary text) — never platform secrets.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsAd = model
  .define("ads_ad", {
    id: model.id({ prefix: "adsad" }).primaryKey(),
    tenant_id: model.text(),
    adset_id: model.text().nullable(),
    campaign_id: model.text().nullable(),
    external_id: model.text().nullable(),
    name: model.text().nullable(),
    status: model.text().default("other"),
    external_status: model.text().nullable(),
    creative: model.json().nullable(),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_ad_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_ad_campaign_id",
      on: ["campaign_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsAd
