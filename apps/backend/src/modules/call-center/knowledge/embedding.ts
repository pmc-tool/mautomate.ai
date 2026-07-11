/**
 * Embedding + retrieval primitives for call-center RAG.
 *
 * Provider: OpenAI embeddings (text-embedding-3-small, 1536 dims) via the
 * platform `OPENAI_API_KEY`. No pgvector — vectors are compared in-process with
 * cosine similarity over a tenant+agent-scoped chunk set (see the chunk model).
 *
 * Everything here is provider-agnostic behind `embedTexts`; swap the provider by
 * changing this one function.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIM = 1536

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"

/**
 * Embed a batch of texts. Returns one vector per input, in order. Throws on a
 * hard provider error (caller decides whether to degrade). Empty input → [].
 */
export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  const inputs = texts
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
  if (!inputs.length) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set; cannot embed")
  }

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `embeddings request failed: ${res.status} ${body.slice(0, 200)}`
    )
  }

  const json = (await res.json()) as {
    data?: { embedding: number[]; index: number }[]
  }
  const rows = (json.data ?? [])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
  return rows
}

/** Embed a single text → its vector (or null on empty). */
export const embedOne = async (text: string): Promise<number[] | null> => {
  const [v] = await embedTexts([text])
  return v ?? null
}

/**
 * Split text into overlapping chunks sized for embedding + spoken recall.
 * Paragraph-aware: packs paragraphs up to ~`maxChars`, with a small overlap so a
 * fact that straddles a boundary is still retrievable. Deterministic.
 */
export const chunkText = (
  text: string,
  maxChars = 1200,
  overlapChars = 150
): string[] => {
  const clean = (text ?? "").replace(/\r\n/g, "\n").trim()
  if (!clean) return []

  const paras = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf = ""
  const flush = () => {
    const t = buf.trim()
    if (t) chunks.push(t)
    buf = ""
  }

  for (const para of paras) {
    // A single oversized paragraph is hard-split on sentence boundaries.
    if (para.length > maxChars) {
      flush()
      const sentences = para.split(/(?<=[.!?])\s+/)
      let sb = ""
      for (const s of sentences) {
        if ((sb + " " + s).trim().length > maxChars) {
          if (sb.trim()) chunks.push(sb.trim())
          sb = s
        } else {
          sb = (sb + " " + s).trim()
        }
      }
      if (sb.trim()) chunks.push(sb.trim())
      continue
    }
    if ((buf + "\n\n" + para).trim().length > maxChars) {
      flush()
      buf = para
    } else {
      buf = (buf + "\n\n" + para).trim()
    }
  }
  flush()

  // Add a leading overlap tail from the previous chunk for continuity.
  if (overlapChars > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]
      const tail = prev.slice(Math.max(0, prev.length - overlapChars))
      chunks[i] = `${tail}\n\n${chunks[i]}`
    }
  }
  return chunks
}

/** Cosine similarity of two equal-length vectors. 0 on degenerate input. */
export const cosine = (a: number[], b: number[]): number => {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** Parse a stored JSON embedding safely → number[] (empty on bad data). */
export const parseEmbedding = (raw: unknown): number[] => {
  if (typeof raw !== "string") return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as number[]) : []
  } catch {
    return []
  }
}
