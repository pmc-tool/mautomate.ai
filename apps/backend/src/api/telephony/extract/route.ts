import { resolveTenantId } from "../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../modules/call-center"

/**
 * POST /telephony/extract  (UNPREFIXED — secret-gated by the `/telephony/*`
 * `x-telephony-secret` middleware in `src/api/middlewares.ts`).
 *
 * Post-call structured extraction. The voice runtime (or an async worker) posts
 * a finished transcript here to derive a structured outcome, then we persist the
 * summary + sentiment back onto the `call_center_call` row. This closes the
 * "sentiment / structured extraction is not native to telephony" gap the plan
 * flagged.
 *
 * Body: `{ call_id, tenant_id, transcript }`.
 *
 * Extraction strategy:
 *   - If OPENAI_API_KEY is set, ask the model (see OPENAI_MODEL) to return a
 *     strict JSON object. The fetch is NO-THROW: any network/parse failure
 *     silently falls through to the heuristic below.
 *   - Otherwise (or on any LLM failure), a deterministic heuristic derives a
 *     keyword sentiment and a first/last-turn summary.
 *
 * NO-THROW: like the other telephony webhooks this must never fail the caller —
 * every error is logged and we still return 200 with whatever we derived.
 */

/** The OpenAI chat model used for extraction when a key is configured. */
const OPENAI_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4o-mini"

type Sentiment = "positive" | "neutral" | "negative"

type Extraction = {
  summary: string
  sentiment: Sentiment
  structured: {
    intent: string | null
    order_action: string | null
  }
}

type Turn = { role?: string; speaker?: string; content?: string; text?: string }

/**
 * Normalize an arbitrary transcript payload into an ordered list of
 * `{ speaker, text }` turns. Accepts a plain string, an array of turn objects,
 * or an array of strings — whatever the runtime happens to send.
 */
const normalizeTurns = (
  transcript: unknown
): Array<{ speaker: string; text: string }> => {
  if (typeof transcript === "string") {
    return transcript
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ speaker: "unknown", text: line }))
  }
  if (Array.isArray(transcript)) {
    const turns: Array<{ speaker: string; text: string }> = []
    for (const entry of transcript) {
      if (typeof entry === "string") {
        const text = entry.trim()
        if (text) {
          turns.push({ speaker: "unknown", text })
        }
        continue
      }
      if (entry && typeof entry === "object") {
        const t = entry as Turn
        const text = (t.content ?? t.text ?? "").trim()
        if (text) {
          turns.push({ speaker: t.role ?? t.speaker ?? "unknown", text })
        }
      }
    }
    return turns
  }
  return []
}

/** Flatten normalized turns into a single "speaker: text" block. */
const turnsToText = (
  turns: Array<{ speaker: string; text: string }>
): string => turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")

const POSITIVE_WORDS = [
  "thank",
  "thanks",
  "great",
  "perfect",
  "happy",
  "resolved",
  "appreciate",
  "wonderful",
  "excellent",
  "confirmed",
]
const NEGATIVE_WORDS = [
  "angry",
  "upset",
  "refund",
  "cancel",
  "complaint",
  "terrible",
  "worst",
  "unhappy",
  "frustrat",
  "disappointed",
  "never",
  "wrong",
]

/**
 * Deterministic fallback extraction: keyword-scored sentiment plus a summary
 * built from the first and last meaningful turns. No I/O, always succeeds.
 */
const heuristicExtract = (transcript: unknown): Extraction => {
  const turns = normalizeTurns(transcript)
  const body = turnsToText(turns).toLowerCase()

  let score = 0
  for (const word of POSITIVE_WORDS) {
    if (body.includes(word)) {
      score += 1
    }
  }
  for (const word of NEGATIVE_WORDS) {
    if (body.includes(word)) {
      score -= 1
    }
  }
  const sentiment: Sentiment =
    score > 0 ? "positive" : score < 0 ? "negative" : "neutral"

  let summary = "No transcript content."
  if (turns.length === 1) {
    summary = turns[0].text
  } else if (turns.length > 1) {
    const first = turns[0]
    const last = turns[turns.length - 1]
    summary = `Opened with — ${first.speaker}: ${first.text} | Closed with — ${last.speaker}: ${last.text}`
  }

  return {
    summary,
    sentiment,
    structured: { intent: null, order_action: null },
  }
}

/** Coerce an unknown value into one of the three allowed sentiments. */
const coerceSentiment = (value: unknown): Sentiment => {
  const v = typeof value === "string" ? value.toLowerCase() : ""
  if (v === "positive" || v === "negative") {
    return v
  }
  return "neutral"
}

/** Coerce an unknown value into a trimmed string or null. */
const coerceStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/**
 * Ask OpenAI to extract structured outcome from the transcript. NO-THROW:
 * returns null on any failure (missing key, network error, non-200, unparsable
 * body) so the caller can fall back to the heuristic.
 */
const openaiExtract = async (
  transcript: unknown
): Promise<Extraction | null> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  const turns = normalizeTurns(transcript)
  const transcriptText = turnsToText(turns)
  if (!transcriptText) {
    return null
  }

  const systemPrompt =
    "You are a post-call analyst for an AI phone agent. " +
    "Read the call transcript and return ONLY a JSON object with this exact shape: " +
    '{ "summary": string, "sentiment": "positive" | "neutral" | "negative", ' +
    '"structured": { "intent": string | null, "order_action": string | null } }. ' +
    "summary: 1-2 sentence plain-text recap. sentiment: the customer's overall sentiment. " +
    "intent: why the customer was on the call. order_action: any concrete action taken on an order " +
    "(e.g. 'cancel', 'confirm_cod', 'reschedule_delivery') or null if none."

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcriptText },
        ],
      }),
    })

    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[telephony] extract: OpenAI returned ${resp.status}; using heuristic`
      )
      return null
    }

    const data = (await resp.json()) as any
    const content: unknown = data?.choices?.[0]?.message?.content
    if (typeof content !== "string") {
      return null
    }

    const parsed = JSON.parse(content) as Record<string, unknown>
    const structured = (parsed.structured ?? {}) as Record<string, unknown>

    return {
      summary: coerceStringOrNull(parsed.summary) ?? "",
      sentiment: coerceSentiment(parsed.sentiment),
      structured: {
        intent: coerceStringOrNull(structured.intent),
        order_action: coerceStringOrNull(structured.order_action),
      },
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] extract: OpenAI call failed; using heuristic:", e)
    return null
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const callId = typeof body.call_id === "string" ? body.call_id : ""
  const tenantId =
    (typeof body.tenant_id === "string" && body.tenant_id) ||
    (resolveTenantId("CALL_CENTER_DEFAULT_TENANT"))
  const transcript = body.transcript

  // Derive the extraction: prefer the LLM, fall back to the deterministic
  // heuristic on any miss. Neither path throws.
  let extraction = await openaiExtract(transcript)
  let source: "openai" | "heuristic" = "openai"
  if (!extraction) {
    extraction = heuristicExtract(transcript)
    source = "heuristic"
  }

  // Persist summary + sentiment onto the Call. Best-effort: a failed write must
  // not fail the caller — the derived result is still returned in the response.
  let persisted = false
  if (callId) {
    try {
      const service: any = req.scope.resolve(CALL_CENTER_MODULE)

      // Resolve the Call by our id first, then by provider_call_id (mirrors the
      // call-ended webhook lookup).
      let call: any = null
      try {
        call = await service.retrieveCall(callId)
      } catch {
        // Not our id — fall back to provider id lookup.
      }
      if (!call) {
        const rows = await service.listCalls(
          { provider_call_id: callId, tenant_id: tenantId },
          { take: 1 }
        )
        call = rows?.[0] ?? null
      }

      if (call) {
        await service.updateCalls({
          id: call.id,
          summary: extraction.summary,
          sentiment: extraction.sentiment,
        })
        persisted = true
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[telephony] extract: failed to persist extraction:", e)
    }
  }

  res.status(200).json({
    received: true,
    source,
    persisted,
    extraction,
  })
}
