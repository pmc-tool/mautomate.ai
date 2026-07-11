import { model } from "@medusajs/framework/utils"

/**
 * tenant_config — per-tenant configuration key/value.
 *
 * Two flavours in one table, distinguished by `is_secret`:
 *   - SECRET  (`is_secret=true`): the value is envelope-encrypted into
 *     `value_sealed` (sealed with the tenant's DEK). Stripe/AI/SMTP/telephony
 *     keys live here — never in plaintext, never in `pg_dump` readably, and
 *     redacted from super-admin reads. `value_plain` is always null.
 *   - PLAIN   (`is_secret=false`): non-sensitive config (brand, theme, tracking
 *     ids) stored as json in `value_plain`.
 *
 * This is the per-tenant successor to the module-local SettingsService, which
 * persisted raw JSON with no encryption.
 */
const TenantConfig = model
  .define("tenant_config", {
    id: model.id({ prefix: "tcfg" }).primaryKey(),
    tenant_id: model.text(),
    key: model.text(),
    is_secret: model.boolean().default(false),
    value_sealed: model.text().nullable(),
    value_plain: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_tenant_config_key_unique",
      on: ["tenant_id", "key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_tenant_config_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default TenantConfig
