import { model } from "@medusajs/framework/utils"
import Playbook from "./playbook"

/**
 * call_center_playbook_version — an immutable versioned script body.
 *
 * Each row is one `version` of a Playbook with its full `definition` (the
 * conversation graph / prompt config). `published` marks the version that is
 * live for its parent Playbook.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const PlaybookVersion = model
  .define("call_center_playbook_version", {
    id: model.id({ prefix: "pbver" }).primaryKey(),
    tenant_id: model.text(),
    version: model.number(),
    definition: model.json(),
    published: model.boolean().default(false),
    playbook: model.belongsTo(() => Playbook, { mappedBy: "versions" }),
  })
  .indexes([
    {
      name: "IDX_call_center_playbook_version_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default PlaybookVersion
