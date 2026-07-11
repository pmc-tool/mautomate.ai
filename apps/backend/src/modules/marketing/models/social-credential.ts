import { model } from "@medusajs/framework/utils"

/**
 * marketing_social_credential — the sealed OAuth token material for a connected
 * marketing_social_account.
 *
 * Kept in a SEPARATE table from the account so tokens can be rotated, sealed,
 * and access-controlled independently of the account metadata. `*_enc` columns
 * hold encrypted/sealed values (never plaintext); `sealed_alg` records the
 * sealing algorithm so a rotation can decrypt older rows.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; the composite
 * (tenant_id, social_account_id) index backs per-account credential lookups.
 */
const MarketingSocialCredential = model
  .define("marketing_social_credential", {
    id: model.id({ prefix: "mscred" }).primaryKey(),
    tenant_id: model.text(),
    social_account_id: model.text(),
    access_token_enc: model.text().nullable(),
    refresh_token_enc: model.text().nullable(),
    token_type: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    sealed_alg: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_social_credential_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_social_credential_tenant_account",
      on: ["tenant_id", "social_account_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSocialCredential
