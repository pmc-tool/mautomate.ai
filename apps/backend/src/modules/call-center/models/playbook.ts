import { model } from "@medusajs/framework/utils"
import PlaybookVersion from "./playbook-version"

/**
 * call_center_playbook — a named, versioned conversation script for a use case.
 *
 * The container: `use_case` + `name` identify it, `status` gates draft vs
 * published, and `current_version_id` points at the live PlaybookVersion. The
 * actual script bodies live in `versions` (call_center_playbook_version).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const Playbook = model
  .define("call_center_playbook", {
    id: model.id({ prefix: "playbook" }).primaryKey(),
    tenant_id: model.text(),
    use_case: model.text(),
    name: model.text(),
    status: model.enum(["draft", "published"]).default("draft"),
    current_version_id: model.text().nullable(),
    versions: model.hasMany(() => PlaybookVersion, { mappedBy: "playbook" }),
  })
  .indexes([
    {
      name: "IDX_call_center_playbook_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Playbook
