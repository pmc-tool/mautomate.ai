import { model } from "@medusajs/framework/utils"
import MarketingAgentVersion from "./agent-version"

/**
 * marketing_agent — a named, versioned marketing AI agent.
 *
 * The container: `name` + `kind` identify what the agent does,
 * `instructions`/`model`/`brand_voice_id`/`playbook`/`tools` configure its live
 * behavior, and `current_version_id` points at the live MarketingAgentVersion.
 * The immutable definitions live in `versions` (marketing_agent_version).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingAgent = model
  .define("marketing_agent", {
    id: model.id({ prefix: "magent" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    /**
     * What the agent does.
     *
     * SUPPORTED: "social" (the merchant social-media agents that draft and
     * schedule posts - see modules/marketing/agents/agent-runner.ts), plus
     * "content" and "seo".
     *
     * @deprecated the "inbox" kind is DEAD (A-6). Conversational replies are now
     * owned by marketing_chatbot, which carries its own persona; nothing creates
     * or reads an inbox-kind agent any more. The enum member survives only
     * because narrowing a Postgres check constraint would need a migration. Do
     * not create agents with kind "inbox".
     */
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
