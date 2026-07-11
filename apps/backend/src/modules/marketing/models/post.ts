import { model } from "@medusajs/framework/utils"

import MarketingPostTarget from "./post-target"
import MarketingPostMedia from "./post-media"
import MarketingPostRevision from "./post-revision"

/**
 * marketing_post — a single piece of social/marketing content authored once and
 * fanned out to one or more platform targets.
 *
 * The post carries the canonical copy (title / body / hashtags / link) plus the
 * publishing lifecycle status. Per-platform variations and delivery state live
 * on the child `targets`; attached media on `media`; edit history on `revisions`.
 * A post may originate manually, from an agent, from a product widget, or from
 * an automation.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. The composite (tenant_id, status)
 * index backs status-filtered listing per tenant.
 */
const MarketingPost = model
  .define("marketing_post", {
    id: model.id({ prefix: "mpost" }).primaryKey(),
    tenant_id: model.text(),
    status: model
      .enum([
        "draft",
        "needs_approval",
        "scheduled",
        "publishing",
        "published",
        "partially_published",
        "failed",
      ])
      .default("draft"),
    title: model.text().nullable(),
    body: model.text().nullable(),
    hashtags: model.json().nullable(),
    link_url: model.text().nullable(),
    product_ids: model.json().nullable(),
    campaign_id: model.text().nullable(),
    brand_voice_id: model.text().nullable(),
    agent_id: model.text().nullable(),
    created_by_user_id: model.text().nullable(),
    source: model
      .enum(["manual", "agent", "product_widget", "automation"])
      .default("manual"),
    targets: model.hasMany(() => MarketingPostTarget, { mappedBy: "post" }),
    media: model.hasMany(() => MarketingPostMedia, { mappedBy: "post" }),
    revisions: model.hasMany(() => MarketingPostRevision, { mappedBy: "post" }),
  })
  .indexes([
    {
      name: "IDX_marketing_post_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_post_tenant_status",
      on: ["tenant_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingPost
