/**
 * Knowledge ingestion + retrieval (RAG) for call-center agents.
 *
 * Ingest: chunk a knowledge entry's text → embed → replace that entry's chunks.
 * Retrieve: embed the query → cosine-rank the tenant+agent-scoped chunk set →
 * return the top-k snippets.
 *
 * TENANT ISOLATION: every chunk read/write is filtered by BOTH `tenant_id` and
 * `agent_id`. Retrieval fetches only `{ tenant_id, agent_id }` chunks, so a
 * query can never surface another tenant's (or another agent's) knowledge.
 */
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  chunkText,
  cosine,
  embedOne,
  embedTexts,
  parseEmbedding,
} from "./embedding"

type Cc = any

/** Compose the embeddable text for a knowledge entry. */
const entryText = (entry: any): string => {
  const parts = [entry?.name, entry?.content].filter(
    (p) => typeof p === "string" && p.trim()
  )
  return parts.join("\n\n").trim()
}

/**
 * Re-ingest ONE knowledge entry: delete its existing chunks, then chunk + embed
 * + store fresh. Tenant+agent scoped. Returns the number of chunks written.
 * Best-effort embedding: throws only on a hard provider failure so the caller
 * can surface it; a text-less entry is a no-op (0).
 */
export const ingestKnowledgeEntry = async (
  cc: Cc,
  entry: any
): Promise<number> => {
  const tenant_id = entry?.tenant_id
  const agent_id = entry?.agent_id
  const knowledge_id = entry?.id
  if (!tenant_id || !agent_id || !knowledge_id) return 0

  // Drop any prior chunks for this entry (scoped) so re-ingest is idempotent.
  const existing = await cc
    .listKnowledgeChunks(
      { tenant_id, agent_id, knowledge_id },
      { take: 1000 }
    )
    .catch(() => [])
  if (Array.isArray(existing) && existing.length) {
    await cc
      .deleteKnowledgeChunks(existing.map((c: any) => c.id))
      .catch(() => {})
  }

  const text = entryText(entry)
  const chunks = chunkText(text)
  if (!chunks.length) return 0

  const vectors = await embedTexts(chunks)
  if (vectors.length !== chunks.length) {
    throw new Error(
      `embedding count mismatch (${vectors.length} vs ${chunks.length})`
    )
  }

  const rows = chunks.map((content, i) => ({
    tenant_id,
    agent_id,
    knowledge_id,
    content,
    embedding: JSON.stringify(vectors[i]),
    embedding_model: EMBEDDING_MODEL,
    dim: EMBEDDING_DIM,
    seq: i,
  }))
  await cc.createKnowledgeChunks(rows)
  return rows.length
}

/**
 * Re-ingest ALL knowledge entries for one agent. Returns totals. Used by the
 * backfill script and the "re-embed agent" action.
 */
export const ingestAgentKnowledge = async (
  cc: Cc,
  tenant_id: string,
  agent_id: string
): Promise<{ entries: number; chunks: number }> => {
  const entries = await cc
    .listKnowledgeEntries({ tenant_id, agent_id }, { take: 1000 })
    .catch(() => [])
  let chunks = 0
  for (const entry of entries as any[]) {
    chunks += await ingestKnowledgeEntry(cc, entry).catch(() => 0)
  }
  return { entries: (entries as any[]).length, chunks }
}

export type KnowledgeHit = {
  content: string
  score: number
  knowledge_id: string
  seq: number
}

/**
 * Retrieve the top-k knowledge snippets for a query, scoped to {tenant, agent}.
 * Returns [] when there is no knowledge, no query, or embedding fails (the
 * caller degrades gracefully — the agent then says it doesn't have the info).
 */
export const retrieveKnowledge = async (
  cc: Cc,
  tenant_id: string,
  agent_id: string,
  query: string,
  k = 4,
  minScore = 0.18
): Promise<KnowledgeHit[]> => {
  if (!tenant_id || !agent_id || !query || !query.trim()) return []

  // SCOPE: only this tenant + agent's chunks are ever loaded.
  const rows = await cc
    .listKnowledgeChunks({ tenant_id, agent_id }, { take: 2000 })
    .catch(() => [])
  if (!Array.isArray(rows) || !rows.length) return []

  let qvec: number[] | null = null
  try {
    qvec = await embedOne(query)
  } catch {
    return []
  }
  if (!qvec) return []

  const scored: KnowledgeHit[] = []
  for (const r of rows as any[]) {
    const vec = parseEmbedding(r.embedding)
    if (!vec.length) continue
    const score = cosine(qvec, vec)
    if (score < minScore) continue
    scored.push({
      content: r.content,
      score,
      knowledge_id: r.knowledge_id,
      seq: r.seq ?? 0,
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
