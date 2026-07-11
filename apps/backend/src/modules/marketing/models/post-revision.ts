import { model } from "@medusajs/framework/utils"

import MarketingPost from "./post"

/**
 * marketing_post_revision — an immutable point-in-time snapshot of a marketing
 * post's content.
 *
 * Each edit bumps `version` and stores the full `snapshot` json so authors can
 * review or restore prior copy. The partial-unique (tenant_id, post_id, version)
 * index (where deleted_at IS NULL) guarantees at most one live row per version
 * per post per tenant.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingPostRevision = model
  .define("marketing_post_revision", {
    id: model.id({ prefix: "mprev" }).primaryKey(),
    tenant_id: model.text(),
    version: model.number(),
    snapshot: model.json().nullable(),
    created_by_user_id: model.text().nullable(),
    post: model.belongsTo(() => MarketingPost, { mappedBy: "revisions" }),
  })
  .indexes([
    {
      name: "IDX_marketing_post_revision_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_post_revision_tenant_post_version_unique",
      on: ["tenant_id", "post_id", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingPostRevision
