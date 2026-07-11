import { model } from "@medusajs/framework/utils"
import MarketingVideoScene from "./video-scene"

/**
 * marketing_video_project — an AI-assisted video render job.
 *
 * `title` names it, `status` tracks the render lifecycle (draft, rendering,
 * ready, failed), `aspect_ratio`/`provider`/`params` configure the render,
 * `output_file_id` points at the finished asset, and `product_id` an optional
 * subject binding. Its ordered shots live in `scenes` (marketing_video_scene).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingVideoProject = model
  .define("marketing_video_project", {
    id: model.id({ prefix: "mvproj" }).primaryKey(),
    tenant_id: model.text(),
    title: model.text().nullable(),
    status: model
      .enum(["draft", "rendering", "ready", "failed"])
      .default("draft"),
    aspect_ratio: model.text().nullable(),
    provider: model.text().nullable(),
    output_file_id: model.text().nullable(),
    params: model.json().nullable(),
    product_id: model.text().nullable(),
    scenes: model.hasMany(() => MarketingVideoScene, { mappedBy: "project" }),
  })
  .indexes([
    {
      name: "IDX_marketing_video_project_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingVideoProject
