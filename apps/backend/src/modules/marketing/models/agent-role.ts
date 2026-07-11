import { model } from "@medusajs/framework/utils"

/**
 * marketing_agent_role — explicit marketing role grant for a Medusa admin user.
 *
 * Layers a marketing permission tier (`admin` / `manager` / `agent`) on top of
 * the core User, keyed by `user_id`. FAIL-CLOSED: the ABSENCE of a live row means
 * NO access — enforced later in the `/admin/marketing/*` middleware; this model
 * only stores the grant. The partial-unique (tenant_id, user_id) index gives at
 * most one live role row per user per tenant (upsert semantics).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingAgentRole = model
  .define("marketing_agent_role", {
    id: model.id({ prefix: "mrole" }).primaryKey(),
    tenant_id: model.text(),
    user_id: model.text(),
    role: model.enum(["admin", "manager", "agent"]).default("agent"),
  })
  .indexes([
    {
      name: "IDX_marketing_agent_role_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_agent_role_tenant_user_unique",
      on: ["tenant_id", "user_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingAgentRole
