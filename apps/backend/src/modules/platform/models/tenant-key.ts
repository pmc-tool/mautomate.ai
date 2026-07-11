import { model } from "@medusajs/framework/utils"

/**
 * tenant_key — a per-tenant data-encryption key (DEK), stored ONLY in its
 * KEK-wrapped form (`wrapped_dek`). The raw DEK never touches the database.
 *
 * Envelope encryption: the platform master key (PLATFORM_KEK) wraps this DEK;
 * the DEK seals the tenant's secrets in `tenant_config`. `key_version` tracks
 * the KEK generation that wrapped it (for rotation). Exactly one `active` key
 * per tenant.
 */
const TenantKey = model
  .define("tenant_key", {
    id: model.id({ prefix: "tkey" }).primaryKey(),
    tenant_id: model.text(),
    wrapped_dek: model.text(),
    key_version: model.number().default(1),
    active: model.boolean().default(true),
  })
  .indexes([
    {
      name: "IDX_tenant_key_active_unique",
      on: ["tenant_id"],
      unique: true,
      where: "deleted_at IS NULL AND active = true",
    },
  ])

export default TenantKey
