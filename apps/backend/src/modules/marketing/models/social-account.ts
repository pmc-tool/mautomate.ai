import { model } from "@medusajs/framework/utils"

/**
 * marketing_social_account — a connected outbound social/publishing destination
 * for a tenant (a Facebook page, an Instagram account, a WordPress site, ...).
 *
 * One row per connected account per platform. `status` tracks the health of the
 * connection (connected / expired / revoked / error); tokens live separately in
 * marketing_social_credential. `external_id` is the platform's own id for the
 * account and, together with (tenant_id, platform), is partial-unique so a
 * given remote account is connected at most once per tenant.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingSocialAccount = model
  .define("marketing_social_account", {
    id: model.id({ prefix: "msacct" }).primaryKey(),
    tenant_id: model.text(),
    platform: model.enum([
      "facebook",
      "instagram",
      "youtube",
      "linkedin",
      "tiktok",
      "x",
      "wordpress",
      "pinterest",
      "threads",
      "telegram",
    ]),
    external_id: model.text().nullable(),
    handle: model.text().nullable(),
    display_name: model.text().nullable(),
    avatar_url: model.text().nullable(),
    scopes: model.json().nullable(),
    status: model
      .enum(["connected", "expired", "revoked", "error"])
      .default("connected"),
    connected_by_user_id: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_social_account_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_social_account_tenant_platform_status",
      on: ["tenant_id", "platform", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_social_account_tenant_platform_external_unique",
      on: ["tenant_id", "platform", "external_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      // Backs the cross-tenant inbound-attribution lookup by receiving account
      // (platform, external_id) -> owning tenant. The unique index above leads
      // with tenant_id and cannot serve this un-tenanted lookup.
      name: "IDX_marketing_social_account_platform_external",
      on: ["platform", "external_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSocialAccount
