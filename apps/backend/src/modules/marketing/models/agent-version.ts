import { model } from "@medusajs/framework/utils"
import MarketingAgent from "./agent"

/**
 * marketing_agent_version — an immutable versioned marketing agent definition.
 *
 * Each row is one `version` of a MarketingAgent with its full `definition` (the
 * prompt / tool / behavior config). `published` marks the version that is live
 * for its parent MarketingAgent.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingAgentVersion = model
  .define("marketing_agent_version", {
    id: model.id({ prefix: "mavers" }).primaryKey(),
    tenant_id: model.text(),
    version: model.number(),
    definition: model.json(),
    published: model.boolean().default(false),
    agent: model.belongsTo(() => MarketingAgent, { mappedBy: "versions" }),
  })
  .indexes([
    {
      name: "IDX_marketing_agent_version_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingAgentVersion
