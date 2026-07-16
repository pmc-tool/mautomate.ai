import { model } from "@medusajs/framework/utils"

/**
 * ads_connection — a merchant's authorized identity on an ad platform (the
 * Meta user who granted ads_management, later the Google/TikTok principal).
 *
 * This is the OAuth root of the Advertising panel: ad accounts (ads_account)
 * hang off a connection, and every API call to the platform authenticates with
 * the tokens sealed here (AES-256-GCM via the marketing vault, same key as the
 * social credential vault). Tokens are NEVER stored in plaintext.
 *
 * Ad connections are deliberately separate from marketing_social_account: the
 * social row is a publishing destination (a Page); this row is an advertising
 * principal with a much more powerful scope set, its own consent screen, and
 * its own revocation lifecycle.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsConnection = model
  .define("ads_connection", {
    id: model.id({ prefix: "adcon" }).primaryKey(),
    tenant_id: model.text(),
    platform: model.enum(["meta", "google", "tiktok", "mock"]),
    external_user_id: model.text().nullable(),
    display_name: model.text().nullable(),
    scopes: model.json().nullable(),
    access_token_enc: model.text().nullable(),
    refresh_token_enc: model.text().nullable(),
    token_type: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    status: model
      .enum(["connected", "expired", "revoked", "error"])
      .default("connected"),
    connected_by_user_id: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_connection_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_connection_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_user_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsConnection
