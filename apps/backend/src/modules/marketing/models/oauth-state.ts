import { model } from "@medusajs/framework/utils"

/**
 * marketing_oauth_state — a short-lived, single-use CSRF/PKCE state row for an
 * in-flight social OAuth connect flow.
 *
 * Minted when a connect flow starts and consumed at the callback: `state` is the
 * opaque anti-CSRF token (partial-unique while live), `code_verifier_enc` holds
 * the sealed PKCE verifier, and `consumed_at` marks the row spent so it cannot be
 * replayed. `expires_at` bounds the flow; the (tenant_id, expires_at) index backs
 * expiry sweeps.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingOauthState = model
  .define("marketing_oauth_state", {
    id: model.id({ prefix: "mostate" }).primaryKey(),
    tenant_id: model.text(),
    state: model.text(),
    platform: model.text(),
    user_id: model.text().nullable(),
    code_verifier_enc: model.text().nullable(),
    redirect_uri: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    consumed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_oauth_state_state_unique",
      on: ["state"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_oauth_state_tenant_expires",
      on: ["tenant_id", "expires_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingOauthState
