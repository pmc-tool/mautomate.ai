import { model } from "@medusajs/framework/utils"

/**
 * call_center_knowledge — one knowledge-base entry attached to a call agent.
 *
 * A merchant trains an agent by attaching reference material: raw text/FAQ, a
 * URL to crawl, an uploaded file, or a product-catalog pointer. `source_type`
 * classifies the entry; `content` holds inline text (faq/text), `url` holds an
 * external pointer (url/file). `embedding_ref` is reserved for the vector
 * representation used by retrieval — populated later when RAG is wired (the
 * embedding step is vendor-key-gated, so this model is storage-only for now).
 *
 * `agent_id` references a call_center_playbook.id (the agent). It is a plain
 * text FK (no relation) so attaching KB never mutates the Playbook model.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id + agent_id.
 */
const CallCenterKnowledge = model
  .define("call_center_knowledge", {
    id: model.id({ prefix: "ccknow" }).primaryKey(),
    tenant_id: model.text(),
    agent_id: model.text(),
    name: model.text(),
    source_type: model
      .enum(["faq", "text", "url", "file", "product_catalog"])
      .default("text"),
    content: model.text().nullable(),
    url: model.text().nullable(),
    embedding_ref: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_knowledge_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_call_center_knowledge_agent_id",
      on: ["agent_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallCenterKnowledge
