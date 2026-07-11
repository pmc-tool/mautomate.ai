import { model } from "@medusajs/framework/utils"

/**
 * marketing_setting — durable, tenant-scoped runtime key/value store for
 * ops-level flags the marketing engine reads at runtime.
 *
 * Rows here can be flipped live WITHOUT a redeploy. Values are json so a setting
 * can hold a boolean, number, string or object.
 *
 * The partial-unique (tenant_id, key) index (where deleted_at IS NULL) gives at
 * most one live row per key per tenant, so `set` is a clean upsert.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; single-tenant run uses a default
 * constant tenant.
 */
const MarketingSetting = model
  .define("marketing_setting", {
    id: model.id({ prefix: "mset" }).primaryKey(),
    tenant_id: model.text(),
    key: model.text(),
    value: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_setting_tenant_key_unique",
      on: ["tenant_id", "key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSetting
