import { model } from "@medusajs/framework/utils"

/**
 * marketing_knowledge_chunk — one embedded chunk of a chatbot knowledge source.
 *
 * RAG storage WITHOUT pgvector (the pooled Postgres has no `vector` extension):
 * each chunk stores its embedding as a JSON float array in `embedding`. Retrieval
 * fetches the tenant+bot-scoped chunk set and ranks by cosine similarity in
 * application code — the same approach as call_center_knowledge_chunk. For
 * per-tenant KBs (dozens–hundreds of chunks) this is fast, fully portable, and
 * tenant-scoped BY CONSTRUCTION: there is no shared vector index that could bleed
 * one tenant's vectors into another's.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; `owner_id` (a marketing_chatbot id)
 * scopes to one bot; `source_id` (a marketing_chatbot_data id) links back to the
 * source entry so a re-ingest can replace exactly that entry's chunks.
 */
const MarketingKnowledgeChunk = model
  .define("marketing_knowledge_chunk", {
    id: model.id({ prefix: "mkchunk" }).primaryKey(),
    tenant_id: model.text(),
    owner_id: model.text(),
    source_id: model.text(),
    // The chunk's source text (handed to the LLM as retrieved context).
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
      name: "IDX_marketing_knowledge_chunk_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Backs retrieval: the whole candidate set for one bot in one tenant.
      name: "IDX_marketing_knowledge_chunk_tenant_owner",
      on: ["tenant_id", "owner_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Backs re-ingest: delete exactly one source's chunks.
      name: "IDX_marketing_knowledge_chunk_source_id",
      on: ["source_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingKnowledgeChunk
