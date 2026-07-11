import { model } from "@medusajs/framework/utils"

/**
 * marketing_platform_credential — a PLATFORM-level social/messaging app secret.
 *
 * These are the OAuth APP credentials (Facebook App ID/Secret, LinkedIn client,
 * WhatsApp/Messenger app secrets, X client, etc.) that the platform owner sets
 * ONCE so merchants can then OAuth-connect their own accounts. They are NOT
 * per-tenant — one set powers every store — so there is no tenant_id here; the
 * super-admin platform gate (`/admin/platform/*`) is the access boundary.
 *
 * The value is stored ENCRYPTED (`value_enc`, sealed with MARKETING_SECRET_KEY)
 * and is only ever decrypted server-side into `process.env` at use. `key` is the
 * canonical env var name (e.g. MARKETING_FACEBOOK_APP_SECRET), unique.
 */
const MarketingPlatformCredential = model
  .define("marketing_platform_credential", {
    id: model.id({ prefix: "mpcred" }).primaryKey(),
    key: model.text(),
    value_enc: model.text(),
  })
  .indexes([
    {
      name: "IDX_marketing_platform_credential_key",
      on: ["key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingPlatformCredential
