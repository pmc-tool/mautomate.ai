import { model } from "@medusajs/framework/utils"

/**
 * call_center_setting — durable, tenant-scoped runtime key/value store for
 * ops-level flags the call-center engine reads at runtime.
 *
 * This is the DURABLE RUNTIME layer that sits BELOW the compile-time master
 * gate (`CALL_CENTER_ENABLED`): the env flag decides whether the feature is
 * compiled/scheduled at all, while rows here can be flipped live (e.g. an
 * emergency "outbound_halted" kill switch) WITHOUT a redeploy. Values are json
 * so a setting can hold a boolean, number, string or object.
 *
 * The partial-unique (tenant_id, key) index (where deleted_at IS NULL) gives at
 * most one live row per key per tenant, so `set` is a clean upsert.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; single-tenant run uses a default
 * constant tenant.
 */
const CallCenterSetting = model
  .define("call_center_setting", {
    id: model.id({ prefix: "ccset" }).primaryKey(),
    tenant_id: model.text(),
    key: model.text(),
    value: model.json(),
  })
  .indexes([
    {
      name: "IDX_call_center_setting_tenant_key_unique",
      on: ["tenant_id", "key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CallCenterSetting
