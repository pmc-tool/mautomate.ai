import { model } from "@medusajs/framework/utils"
import MarketingAgentVersion from "./agent-version"

/**
 * marketing_agent — a named, versioned marketing AI agent.
 *
 * The container: `name` + `kind` identify what the agent does (content, social,
 * inbox, seo), `instructions`/`model`/`brand_voice_id`/`playbook`/`tools`
 * configure its live behavior, and `current_version_id` points at the live
 * MarketingAgentVersion. The immutable definitions live in `versions`
 * (marketing_agent_version).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingAgent = model
  .define("marketing_agent", {
    id: model.id({ prefix: "magent" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    kind: model.enum(["content", "social", "inbox", "seo"]).default("content"),
    instructions: model.text().nullable(),
    model: model.text().nullable(),
    brand_voice_id: model.text().nullable(),
    playbook: model.json().nullable(),
    tools: model.json().nullable(),
    current_version_id: model.text().nullable(),
    active: model.boolean().default(true),
    versions: model.hasMany(() => MarketingAgentVersion, { mappedBy: "agent" }),
  })
  .indexes([
    {
      name: "IDX_marketing_agent_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingAgent
