import { model } from "@medusajs/framework/utils"

/**
 * call_center_knowledge_chunk — one embedded chunk of a knowledge-base entry.
 *
 * RAG storage WITHOUT pgvector (the pooled Postgres has no `vector` extension):
 * each chunk stores its embedding as a JSON float array in `embedding`. Retrieval
 * fetches the tenant+agent-scoped chunk set and ranks by cosine similarity in
 * application code. For per-tenant KBs (dozens–hundreds of chunks) this is fast,
 * fully portable, and — critically — tenant-scoped BY CONSTRUCTION: there is no
 * shared vector index that could bleed one tenant's vectors into another's.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; `agent_id` (a call_center_playbook
 * id) scopes to one agent; `knowledge_id` links back to the source entry so a
 * re-ingest can replace exactly that entry's chunks. Indexed on all three.
 */
const CallCenterKnowledgeChunk = model
  .define("call_center_knowledge_chunk", {
    id: model.id({ prefix: "ccchunk" }).primaryKey(),
    tenant_id: model.text(),
    agent_id: model.text(),
    knowledge_id: model.text(),
    // The chunk's source text (spoken back / handed to the LLM as context).
    content: model.text(),
    // JSON-encoded float array (the embedding vector). Text, not vector — see
    // the file header: no pgvector on this DB.
    embedding: model.text(),
    // Embedding model id + dimension, so a model change can be detected and the
    // chunk re-embedded rather than silently compared across incompatible spaces.
    embedding_model: model.text().nullable(),
    dim: model.number().nullable(),
    // Ordinal of this chunk within its source entry.
    seq: model.number().default(0),
  })
  .indexes([
    {
      name: "IDX_cc_knowledge_chunk_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cc_knowledge_chunk_agent_id",
      on: ["agent_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cc_knowledge_chunk_knowledge_id",
      on: ["knowledge_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallCenterKnowledgeChunk
