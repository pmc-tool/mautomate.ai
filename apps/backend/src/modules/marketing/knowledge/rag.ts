/**
 * Chatbot knowledge (RAG) — training + retrieval for marketing chatbots.
 *
 * Training: chunk each of a bot's `marketing_chatbot_data` sources -> embed ->
 * REPLACE exactly that source's `marketing_knowledge_chunk` rows (so retraining
 * is idempotent), stamping per-source `status` (embedded | failed + error) and
 * the bot's `training_status` (training -> trained | not_trained).
 *
 * Retrieval: embed the question -> cosine-rank the {tenant, bot}-scoped chunk
 * set in-process -> return the top-k snippets.
 *
 * The embedding primitives (OpenAI text-embedding-3-small, chunker, cosine,
 * JSON vector codec) are REUSED from the call-center library — they are pure,
 * dependency-free functions, so this module imports them rather than restating
 * them. No pgvector: vectors are JSON text on the chunk row (see the model).
 *
 * TENANT ISOLATION: every chunk read/write is filtered by BOTH `tenant_id` and
 * `owner_id` (the chatbot id). A query can never surface another tenant's — or
 * another bot's — knowledge, and a chatbot whose `tenant_id` does not match the
 * caller's tenant is treated as not found (fail closed).
 *
 * NO-THROW: training and retrieval both run on paths that must not break the
 * inbox (a webhook ingest, a training click). A missing OPENAI_API_KEY or a
 * provider failure degrades to "failed sources" / "no context" — never a throw.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import {
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  chunkText,
  cosine,
  embedOne,
  embedTexts,
  parseEmbedding,
} from "../../call-center/knowledge/embedding"
import { MARKETING_MODULE } from "../index"

/** Max sources trained in one pass (a runaway bot cannot stall the process). */
const MAX_SOURCES = 500
/** Max chunks written per source (bounds one oversized document). */
const MAX_CHUNKS_PER_SOURCE = 400
/** Max chunks scanned per retrieval (bounds the in-process cosine ranking). */
const MAX_CHUNKS_SCANNED = 2000
/** Default snippets handed to the LLM as context. */
const DEFAULT_TOP_K = 4
/** Below this cosine score a chunk is noise, not context. */
const DEFAULT_MIN_SCORE = 0.18

const NO_API_KEY_ERROR =
  "OPENAI_API_KEY is not configured on this instance; knowledge cannot be embedded."

/** Compose the embeddable text for one knowledge source. */
const sourceText = (source: any): string => {
  const parts = [source?.source, source?.content].filter(
    (p) => typeof p === "string" && p.trim().length > 0
  )
  return parts.join("\n\n").trim()
}

export type TrainingResult = {
  chatbot_id: string
  training_status: "not_trained" | "trained"
  sources: number
  embedded: number
  failed: number
  chunks: number
  /** Set when training could not run at all (unknown bot, no API key, …). */
  error?: string
}

/** Delete every chunk previously produced from one source (tenant+bot scoped). */
const dropSourceChunks = async (
  mk: any,
  tenantId: string,
  chatbotId: string,
  sourceId: string
): Promise<void> => {
  const existing = await mk
    .listMarketingKnowledgeChunks(
      { tenant_id: tenantId, owner_id: chatbotId, source_id: sourceId },
      { take: MAX_CHUNKS_PER_SOURCE * 2 }
    )
    .catch(() => [])
  if (Array.isArray(existing) && existing.length) {
    await mk
      .deleteMarketingKnowledgeChunks(existing.map((c: any) => c.id))
      .catch(() => {})
  }
}

/**
 * (Re-)train ONE chatbot: embed all of its knowledge sources into
 * `marketing_knowledge_chunk`. Idempotent — a source's prior chunks are dropped
 * before its fresh ones are written, so retraining never duplicates context.
 *
 * Never throws. A source that cannot be embedded is marked `failed` with the
 * reason on the row; the bot ends `trained` when at least one source embedded,
 * otherwise `not_trained`.
 */
export const embedChatbotSources = async (
  container: MedusaContainer,
  tenantId: string,
  chatbotId: string
): Promise<TrainingResult> => {
  const empty: TrainingResult = {
    chatbot_id: chatbotId,
    training_status: "not_trained",
    sources: 0,
    embedded: 0,
    failed: 0,
    chunks: 0,
  }
  if (!tenantId || !chatbotId) {
    return { ...empty, error: "tenant and chatbot are required" }
  }

  const mk: any = container.resolve(MARKETING_MODULE)

  // FAIL CLOSED: the bot must exist AND belong to this tenant.
  const chatbot = await mk.retrieveMarketingChatbot(chatbotId).catch(() => null)
  if (!chatbot || chatbot.tenant_id !== tenantId) {
    return { ...empty, error: `Chatbot ${chatbotId} was not found` }
  }

  // NOTE: MedusaService does not pluralise "MarketingChatbotData" — the
  // generated readers are listMarketingChatbotData / updateMarketingChatbotData.
  const sources: any[] = await mk
    .listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: chatbotId },
      { take: MAX_SOURCES }
    )
    .catch(() => [])

  if (!sources.length) {
    await mk
      .updateMarketingChatbots({ id: chatbotId, training_status: "not_trained" })
      .catch(() => {})
    return { ...empty }
  }

  await mk
    .updateMarketingChatbots({ id: chatbotId, training_status: "training" })
    .catch(() => {})

  const hasApiKey = Boolean(process.env.OPENAI_API_KEY)
  let embedded = 0
  let failed = 0
  let chunksWritten = 0

  for (const source of sources) {
    const markFailed = async (error: string) => {
      failed += 1
      await mk
        .updateMarketingChatbotData({
          id: source.id,
          status: "failed",
          error: error.slice(0, 500),
        })
        .catch(() => {})
    }

    if (!hasApiKey) {
      await markFailed(NO_API_KEY_ERROR)
      continue
    }

    const text = sourceText(source)
    if (!text) {
      await markFailed("This source has no content to embed.")
      continue
    }

    try {
      await dropSourceChunks(mk, tenantId, chatbotId, source.id)

      const chunks = chunkText(text).slice(0, MAX_CHUNKS_PER_SOURCE)
      if (!chunks.length) {
        await markFailed("This source produced no embeddable text.")
        continue
      }

      const vectors = await embedTexts(chunks)
      if (vectors.length !== chunks.length) {
        throw new Error(
          `embedding count mismatch (${vectors.length} vs ${chunks.length})`
        )
      }

      await mk.createMarketingKnowledgeChunks(
        chunks.map((content, i) => ({
          tenant_id: tenantId,
          owner_id: chatbotId,
          source_id: source.id,
          content,
          embedding: JSON.stringify(vectors[i]),
          embedding_model: EMBEDDING_MODEL,
          dim: EMBEDDING_DIM,
          seq: i,
        }))
      )
      chunksWritten += chunks.length
      embedded += 1

      await mk
        .updateMarketingChatbotData({
          id: source.id,
          status: "embedded",
          error: null,
          embedding_ref: `${EMBEDDING_MODEL}:${chunks.length}`,
        })
        .catch(() => {})
    } catch (e: any) {
      await markFailed(e?.message ?? "Embedding failed")
    }
  }

  const training_status: "trained" | "not_trained" =
    embedded > 0 ? "trained" : "not_trained"
  await mk
    .updateMarketingChatbots({ id: chatbotId, training_status })
    .catch(() => {})

  return {
    chatbot_id: chatbotId,
    training_status,
    sources: sources.length,
    embedded,
    failed,
    chunks: chunksWritten,
    error: !hasApiKey ? NO_API_KEY_ERROR : undefined,
  }
}

/**
 * Retrieve the top-k knowledge snippets for a question, scoped to {tenant, bot}.
 * Returns the ranked chunk texts (best first), or [] when the bot has no
 * knowledge, the query is empty, or embedding is unavailable — the caller then
 * answers without retrieved context rather than failing.
 */
export const retrieveContext = async (
  container: MedusaContainer,
  tenantId: string,
  chatbotId: string,
  query: string,
  topK: number = DEFAULT_TOP_K,
  minScore: number = DEFAULT_MIN_SCORE
): Promise<string[]> => {
  if (!tenantId || !chatbotId || !query || !query.trim()) {
    return []
  }
  if (!process.env.OPENAI_API_KEY) {
    return []
  }

  try {
    const mk: any = container.resolve(MARKETING_MODULE)

    // SCOPE: only this tenant's + this bot's chunks are ever loaded.
    const rows: any[] = await mk
      .listMarketingKnowledgeChunks(
        { tenant_id: tenantId, owner_id: chatbotId },
        { take: MAX_CHUNKS_SCANNED }
      )
      .catch(() => [])
    if (!rows.length) {
      return []
    }

    const qvec = await embedOne(query).catch(() => null)
    if (!qvec || !qvec.length) {
      return []
    }

    const scored: { content: string; score: number }[] = []
    for (const row of rows) {
      const vec = parseEmbedding(row.embedding)
      if (!vec.length) {
        continue
      }
      const score = cosine(qvec, vec)
      if (score < minScore) {
        continue
      }
      scored.push({ content: row.content, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, Math.max(1, topK)).map((s) => s.content)
  } catch {
    // NO-THROW: retrieval is best-effort context, never a hard dependency.
    return []
  }
}
