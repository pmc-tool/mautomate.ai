import { model } from "@medusajs/framework/utils"

/**
 * call_center_agent_role — explicit call-center role grant for a Medusa admin
 * user.
 *
 * Layers a call-center permission tier (`supervisor` / `agent`) on top of the
 * core User, keyed by `user_id`. FAIL-CLOSED: the ABSENCE of a live row means NO
 * access — enforced later in the `/admin/call-center/*` middleware; this model
 * only stores the grant. The partial-unique (tenant_id, user_id) index gives at
 * most one live role row per user per tenant (upsert semantics).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AgentRole = model
  .define("call_center_agent_role", {
    id: model.id({ prefix: "carole" }).primaryKey(),
    tenant_id: model.text(),
    user_id: model.text(),
    role: model.enum(["supervisor", "agent"]).default("agent"),
  })
  .indexes([
    {
      name: "IDX_call_center_agent_role_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_call_center_agent_role_tenant_user_unique",
      on: ["tenant_id", "user_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentRole
