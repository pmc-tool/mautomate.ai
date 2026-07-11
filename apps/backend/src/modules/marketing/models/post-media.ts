import { model } from "@medusajs/framework/utils"

import MarketingPost from "./post"

/**
 * marketing_post_media — an image or video asset attached to a marketing post.
 *
 * Ordered by `position`, each row references either an uploaded file (`file_id`)
 * or an external `url`, plus optional dimension/duration metadata used by
 * platform-specific publishers.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingPostMedia = model
  .define("marketing_post_media", {
    id: model.id({ prefix: "mpmed" }).primaryKey(),
    tenant_id: model.text(),
    kind: model.enum(["image", "video"]),
    file_id: model.text().nullable(),
    url: model.text().nullable(),
    alt: model.text().nullable(),
    width: model.number().nullable(),
    height: model.number().nullable(),
    duration: model.number().nullable(),
    position: model.number().default(0),
    post: model.belongsTo(() => MarketingPost, { mappedBy: "media" }),
  })
  .indexes([
    {
      name: "IDX_marketing_post_media_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingPostMedia
