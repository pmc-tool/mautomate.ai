import { model } from "@medusajs/framework/utils"
import MarketingVideoProject from "./video-project"

/**
 * marketing_video_scene — one ordered shot within a video project.
 *
 * `position` orders it within its parent MarketingVideoProject, `script` is the
 * scene copy, `image_file_id`/`voiceover_file_id` its rendered assets, and
 * `duration` its length.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. The composite
 * (tenant_id, video_project_id, position) index backs ordered scene lookups.
 */
const MarketingVideoScene = model
  .define("marketing_video_scene", {
    id: model.id({ prefix: "mvscene" }).primaryKey(),
    tenant_id: model.text(),
    position: model.number().default(0),
    script: model.text().nullable(),
    image_file_id: model.text().nullable(),
    voiceover_file_id: model.text().nullable(),
    duration: model.number().nullable(),
    project: model.belongsTo(() => MarketingVideoProject, {
      mappedBy: "scenes",
    }),
  })
  .indexes([
    {
      name: "IDX_marketing_video_scene_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_video_scene_tenant_project_position",
      on: ["tenant_id", "project_id", "position"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingVideoScene
