"use client"

/* ------------------------------------------------------------------ */
/* 3F AI surface — the fetch layer onto /api/puck/ai-node (seat 2D).    */
/*                                                                     */
/* Token hygiene (ARCH-AI §3.2/§3.3): every request body here is        */
/* exactly one of the node payload shapes the gateway defines — one     */
/* field's text, one item's path + owning node, or one node + the       */
/* block-types-only page outline. Nothing page-wide ever leaves this    */
/* module; auth is the editor ?key= the proxy already validates.        */
/*                                                                     */
/* Failure states (ARCH-AI §12/§4.3) are mapped HERE to one closed      */
/* enum so the box renders each as an explicit UI state, never a        */
/* silent catch: insufficient_credits (402/pre-flight), over_budget     */
/* (413), invalid_patch (422), cannot (200 honesty channel),            */
/* provider_down (5xx/network), stream_drop (SSE ended without done),   */
/* stale_node (mapped by the box when the ref no longer resolves).      */
/* ------------------------------------------------------------------ */

export type AiFailureKind =
  | "insufficient_credits"
  | "over_budget"
  | "invalid_patch"
  | "cannot"
  | "provider_down"
  | "stream_drop"
  | "stale_node"

export type AiFailure = {
  kind: AiFailureKind
  message: string
  /** Credits actually spent (stale_node shows them honestly; all other
   *  failures are never billed — the gateway releases the reservation). */
  credits?: number
}

export type AiPrices = {
  ai_text: number
  ai_node_edit: number
  ai_page_edit?: number
  ai_image: number
}

export type AiMicroOk = {
  ok: true
  text: string
  credits: number
  balance: number | null
  cached: boolean
}
export type AiNodeOk = {
  ok: true
  set: Record<string, unknown>
  before: Record<string, unknown>
  note: string
  credits: number
  balance: number | null
  cached: boolean
}
export type AiFail = { ok: false; f: AiFailure }

/* ---------------- pre-flight price map + wallet memory (§3.8) -------- */

let prices: AiPrices | null = null
let digestVersion: string | null = null
let balance: number | null = null
let metaPromise: Promise<AiPrices | null> | null = null

export const getPrices = (): AiPrices | null => prices
export const getDigestVersion = (): string | null => digestVersion
/** Last-known wallet balance (from any response). null = unknown yet. */
export const getBalance = (): number | null => balance

const noteBalance = (b: unknown): void => {
  if (typeof b === "number" && Number.isFinite(b)) balance = b
}

const editorKey = (): string =>
  typeof window === "undefined"
    ? ""
    : new URLSearchParams(window.location.search).get("key") ?? ""

const endpoint = (): string =>
  `/api/puck/ai-node?key=${encodeURIComponent(editorKey())}`

/** GET {digestVersion, prices} once per editor session (§3.8: chips show
 *  the credit price BEFORE the merchant spends). Failure leaves prices
 *  null — chips stay enabled and the server stays the billing authority. */
export function loadAiMeta(): Promise<AiPrices | null> {
  if (prices) return Promise.resolve(prices)
  if (metaPromise) return metaPromise
  metaPromise = fetch(endpoint())
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { prices?: AiPrices; digestVersion?: string } | null) => {
      if (d && d.prices && typeof d.prices.ai_text === "number") {
        prices = d.prices
        digestVersion = typeof d.digestVersion === "string" ? d.digestVersion : null
      }
      return prices
    })
    .catch(() => null)
    .finally(() => {
      metaPromise = null
    })
  return metaPromise
}

/* ---------------- failure mapping ------------------------------------ */

const failureOf = (status: number, body: Record<string, unknown>): AiFailure => {
  const msg = typeof body.error === "string" ? body.error : ""
  const code = typeof body.code === "string" ? body.code : ""
  if (status === 402 || code === "insufficient_credits") {
    return {
      kind: "insufficient_credits",
      message: msg || "You're out of AI credits. Top up in Billing.",
    }
  }
  if (status === 413 || code === "over_budget") {
    return {
      kind: "over_budget",
      message:
        msg ||
        "This content is too long for a quick edit — try selecting a smaller part.",
    }
  }
  if (status === 422 || code === "invalid_patch") {
    return {
      kind: "invalid_patch",
      message:
        msg || "The AI couldn't produce a safe change — nothing was modified.",
    }
  }
  return {
    kind: "provider_down",
    message: msg || "AI is unavailable right now — your page is untouched.",
  }
}

const networkFailure = (): AiFailure => ({
  kind: "provider_down",
  message: "AI is unavailable right now — your page is untouched.",
})

/* ---------------- Tier 1 micro, streamed (§3.2 + §4.4) --------------- */

export type MicroFieldBody = {
  text: string
  label: string
  action: string
  custom?: string
  html?: boolean
  brand?: string
  variant_nonce?: number
}

/** POST the plain-text micro tier with stream:true and feed each SSE
 *  delta to `onDelta`. Mid-stream text is display-only (§4.4): the box
 *  stages nothing until the `done` event delivers the final value. */
export async function runMicroStream(
  body: MicroFieldBody,
  onDelta: (accumulated: string) => void
): Promise<AiMicroOk | AiFail> {
  let r: Response
  try {
    r = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true }),
    })
  } catch {
    return { ok: false, f: networkFailure() }
  }
  const ct = r.headers.get("content-type") || ""
  if (!ct.includes("text/event-stream")) {
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (r.ok && typeof j.text === "string") {
      noteBalance(j.balance)
      return {
        ok: true,
        text: j.text,
        credits: typeof j.credits === "number" ? j.credits : 0,
        balance,
        cached: j.cached === true,
      }
    }
    return { ok: false, f: failureOf(r.status, j) }
  }
  if (!r.body) return { ok: false, f: networkFailure() }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let acc = ""
  let sawDelta = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        const line = frame.split("\n").find((l) => l.startsWith("data: "))
        if (!line) continue
        let evt: Record<string, unknown>
        try {
          evt = JSON.parse(line.slice(6)) as Record<string, unknown>
        } catch {
          continue
        }
        if (typeof evt.delta === "string") {
          sawDelta = true
          acc += evt.delta
          onDelta(acc)
        } else if (typeof evt.error === "string") {
          // The gateway released the reservation before sending this.
          return { ok: false, f: { kind: "provider_down", message: evt.error } }
        } else if (evt.done === true && typeof evt.text === "string") {
          noteBalance(evt.balance)
          return {
            ok: true,
            text: evt.text,
            credits: typeof evt.credits === "number" ? evt.credits : 0,
            balance,
            cached: false,
          }
        }
      }
    }
  } catch {
    return {
      ok: false,
      f: {
        kind: sawDelta ? "stream_drop" : "provider_down",
        message: sawDelta
          ? "The connection dropped mid-write — nothing was changed."
          : "AI is unavailable right now — your page is untouched.",
      },
    }
  }
  // Stream closed without a done event: a dropped stream leaves the
  // document untouched (§4.4) — surface it, never silently.
  return {
    ok: false,
    f: {
      kind: "stream_drop",
      message: "The connection dropped mid-write — nothing was changed.",
    },
  }
}

/* ---------------- JSON tiers: item micro + Tier 2 node (§3.3) -------- */

export type NodeTierBody = {
  tier: "micro" | "node"
  block_type: string
  /** The ONE owning node — the gateway shrinks it (§3.3); never the page. */
  node: Record<string, unknown>
  action?: string
  custom?: string
  item_path?: string
  /** Block TYPES only, selected node marked by index (§3.3 outline line). */
  page_types?: string[]
  selected_index?: number
  brand?: string
  variant_nonce?: number
}

export async function runNodeTier(body: NodeTierBody): Promise<AiNodeOk | AiFail> {
  let r: Response
  let j: Record<string, unknown>
  try {
    r = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    return { ok: false, f: networkFailure() }
  }
  if (r.ok && typeof j.cannot === "string") {
    // The model's honesty channel — an info state, not an error (§4.3).
    return { ok: false, f: { kind: "cannot", message: j.cannot, credits: 0 } }
  }
  if (r.ok && j.set && typeof j.set === "object" && !Array.isArray(j.set)) {
    noteBalance(j.balance)
    return {
      ok: true,
      set: j.set as Record<string, unknown>,
      before:
        j.before && typeof j.before === "object" && !Array.isArray(j.before)
          ? (j.before as Record<string, unknown>)
          : {},
      note: typeof j.note === "string" ? j.note : "",
      credits: typeof j.credits === "number" ? j.credits : 0,
      balance,
      cached: j.cached === true,
    }
  }
  return { ok: false, f: failureOf(r.status, j) }
}
