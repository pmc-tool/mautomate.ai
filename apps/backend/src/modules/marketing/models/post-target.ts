import { model } from "@medusajs/framework/utils"

import MarketingPost from "./post"

/**
 * marketing_post_target — the per-platform delivery of a parent marketing post.
 *
 * Each row represents the post as it lands on ONE platform/social account,
 * carrying optional per-platform copy overrides plus its own publishing
 * lifecycle and retry bookkeeping (attempts / max_attempts / next_retry_at). The
 * claim-first sweep picks due targets by (tenant_id, status, scheduled_at),
 * claims one, then publishes; external ids/urls are recorded on success.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. The composite
 * (tenant_id, status, scheduled_at) index backs the claim-first publish sweep.
 */
const MarketingPostTarget = model
  .define("marketing_post_target", {
    id: model.id({ prefix: "mptgt" }).primaryKey(),
    tenant_id: model.text(),
    platform: model.text(),
    social_account_id: model.text().nullable(),
    status: model
      .enum(["pending", "scheduled", "publishing", "published", "failed"])
      .default("pending"),
    override_body: model.text().nullable(),
    override_hashtags: model.json().nullable(),
    scheduled_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
    external_post_id: model.text().nullable(),
    external_url: model.text().nullable(),
    attempts: model.number().default(0),
    max_attempts: model.number().default(3),
    next_retry_at: model.dateTime().nullable(),
    error: model.text().nullable(),
    post: model.belongsTo(() => MarketingPost, { mappedBy: "targets" }),
  })
  .indexes([
    {
      name: "IDX_marketing_post_target_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Backs the claim-first publish sweep: due targets per tenant by status
      // + schedule.
      name: "IDX_marketing_post_target_claim_sweep",
      on: ["tenant_id", "status", "scheduled_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingPostTarget
