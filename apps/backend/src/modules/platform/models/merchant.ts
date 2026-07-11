import { model } from "@medusajs/framework/utils"

/**
 * merchant — a store OWNER account for a pooled tenant. Authenticates as the
 * Medusa auth actor_type "merchant" (emailpass); the auth identity's
 * app_metadata.merchant_id points here, and this row's tenant_id scopes every
 * /merchant/* request to exactly one tenant's data. One tenant may have many
 * merchant users.
 *
 * MFA (TOTP):
 *   - mfa_enabled: whether MFA is required for this merchant
 *   - mfa_secret_encrypted: AES-encrypted TOTP secret (kept encrypted at rest)
 *   - mfa_backup_codes_hash: bcrypt-hashed recovery codes (JSON array)
 */
const Merchant = model
  .define("merchant", {
    id: model.id({ prefix: "mer" }).primaryKey(),
    tenant_id: model.text(),
    email: model.text(),
    name: model.text().nullable(),
    status: model.enum(["active", "disabled"]).default("active"),
    mfa_enabled: model.boolean().default(false),
    mfa_secret_encrypted: model.text().nullable(),
    mfa_backup_codes_hash: model.text().nullable(),
  })
  .indexes([
    { name: "IDX_merchant_email_unique", on: ["email"], unique: true, where: "deleted_at IS NULL" },
    { name: "IDX_merchant_tenant", on: ["tenant_id"], unique: false, where: "deleted_at IS NULL" },
  ])

export default Merchant
