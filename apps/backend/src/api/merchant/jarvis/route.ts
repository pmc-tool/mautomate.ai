import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { getAiTextProvider } from "../../../modules/marketing/ai/registry"
import { meterAction } from "../../../modules/platform/integration/metering-guard"
import type { AiToolCall } from "../../../modules/marketing/ai/ai-provider"
import { buildJarvisTools, TOOL_LABELS } from "./_tools"
import {
  WRITE_DEFINITIONS,
  WRITE_BY_NAME,
  WRITE_LABELS,
  isWriteTool,
} from "./_writes"
import { signPlan } from "./_plan-token"
import { loadNotes, notesForPrompt } from "./_memory"
import {
  getConversation,
  historyForPrompt,
  saveMessage,
  maybeTitle,
} from "./_chat"

/**
 * POST /merchant/jarvis — Pixi P1 (read + write-with-confirm, streaming).
 *
 * Runs the agent tool-loop for the AUTHENTICATED merchant and streams the run
 * over Server-Sent Events:
 *   event: thinking  — the loop started
 *   event: tool      — a tool call started/finished ({ id, name, label, state })
 *   event: tool_call — a tool STARTED, with its args ({ id, name, label, kind, args })
 *                      kind = "read" | "write"; args are sanitized (depth 1, primitives)
 *   event: tool_result — a READ tool's data ({ id, name, label, ok, data, error })
 *                      emitted just before the result returns to the model; writes
 *                      carry their data on the `confirm` frame instead
 *   event: confirm   — a WRITE was proposed; the merchant must approve it
 *                      ({ id, action, tier, require_text, summary, details, token, exp })
 *   event: message   — the final natural-language answer ({ text })
 *   event: done      — run finished ({ rounds })
 *   event: error     — { message }
 *
 * Writes never execute here. When the model calls a write tool we run its
 * plan() (which does NOT mutate — it resolves ids server-side and validates),
 * mint a short-lived tenant-bound HMAC plan token, and emit a `confirm` frame.
 * The browser posts the token to `/merchant/jarvis/apply`, which is where the
 * frozen action actually runs. Auth + tenant isolation come free from the
 * `/merchant/*` matcher + resolveMerchant: the tenant is the session's, never
 * the request body's, and every tool is scoped to it.
 */

// CACHE-STABILITY INVARIANT -- DO NOT INTERPOLATE PER-REQUEST DATA HERE.
// This system message + the tool schema form the prompt PREFIX that Novita
// automatically caches. For that cache to hit -- charging the ~66-tool schema +
// this preamble ONCE instead of on every turn/round, and sharing ONE warm cache
// across every conversation AND every tenant -- the prefix MUST be byte-identical
// on every request. So NOTHING per-request or per-tenant (store name, country,
// currency, remembered notes, dates, or any non-deterministic ordering) may
// appear in this string, nor in the tools array (see buildJarvisTools + _writes,
// both assembled in a fixed, static order). Per-store facts + notes ride in the
// per-turn "Store context" block prepended to the merchant message instead.
const SYSTEM = `
You are Pixi, the AI operator built into the merchant's dashboard on mAutomate.
You help the merchant run their online shop and you can BOTH look things up AND make changes.

The current store's name, country and currency, plus any facts the merchant has
asked you to remember, are provided in a "Store context" block at the top of the
merchant's message. Treat that block as the authoritative facts about this store.

Your tools are of two kinds:
- READ tools (check_readiness, store_overview, list_recent_orders, get_order, search_products,
  needs_attention, sales_summary, low_stock, find_customer, inbox_status, domain_status,
  call_center_status, orders_to_deliver, delivery_issues, needs_human, todays_email, visitor_report,
  call_topics, ad_report, compare_ads, list_blog_posts, list_pages, list_collections, list_categories, list_discounts, list_themes, list_campaigns, search_domain): use them freely to get real, live data. NEVER guess numbers, order states or
  setup status — always look them up. For "what should I fix / what's urgent" use needs_attention; for
  revenue/sales use sales_summary. For "is my domain connected / how do I use my own domain" use
  domain_status; for "is my AI phone agent / call center set up" use call_center_status — both return a
  short guidance line; relay it plainly. When the merchant asks you to remember something, use remember.
- Connecting a custom domain needs the merchant to change nameservers at their own registrar and click
  Verify in Settings → Domains. You CAN start it with connect_domain (it sets up the connection and returns the exact nameserver values), but the merchant must change nameservers at their own registrar and click Verify — so propose connect_domain, then guide them through the nameserver step using domain_status. Same for the AI call center: guide them to Call Center to create/publish an agent or buy
  a phone number; you report status, they take those steps in that area.
- ACTION tools (make things happen: publish a product, add a new product, restock a product, set up
  delivery, turn on a payment method, set a price, set the store country, switch the store currency,
  create an ad campaign, launch an ad campaign, post to social media, reply to a waiting customer, hand
  a chat back to the AI, fulfil an order, mark paid, capture, refund, cancel, write/draft or publish a blog post, create or publish a storefront page (About etc.), create a collection or category, create a discount / promo code, switch the storefront theme, generate a logo with AI, schedule a social post, send an email campaign, connect a custom domain): when the merchant clearly
  asks you to DO
  one of these, CALL the matching action tool. It does NOT execute immediately — a confirmation CARD with
  a button appears in the chat automatically. So after calling an action tool, do NOT say "done".
  CONFIRMATION LANGUAGE — get this exactly right, it drives a button in the UI:
  - ONE-TAP actions (set country, set currency, set a price, publish or add a product, restock, set up
    delivery, turn on a payment method, fulfil an order, hand a chat to the AI, draft a blog post or page, create a collection or category, generate a logo): tell the merchant to TAP
    the "Confirm" button on the card. NEVER say "type confirm" — the word "confirm" is never a keyword.
  - TYPE-A-WORD actions (refund, cancel, capture, mark paid, create an ad campaign, launch an ad campaign,
    post to social, reply to a customer, publish a blog post or page, create a discount, switch theme, connect a domain, schedule a post, send an email campaign): the card shows a specific word to TYPE (REFUND, CANCEL, RUN,
    LAUNCH, POST, SEND, PUBLISH, CREATE, SWITCH, CONNECT, SCHEDULE, etc.) then a Confirm button — tell them to type that exact word and tap Confirm.
    Never invent a word.
  You are NOT notified when the merchant taps Confirm — the tap happens in the UI, out of your sight. So:
  - If the merchant (re)states an ACTION to perform — including "go ahead and do X", "do it now: set stock
    to 500", "set the price to 20", or the app sending "Please go ahead and do this now: <something>" — you
    MUST CALL the matching action tool to propose it FRESH. A new confirmation card appears; that is the
    correct, expected response. Re-proposing is always safe (it just shows a new card) — never refuse to
    re-propose an action the merchant is clearly asking for, and never merely say "tap the card above"
    when they've asked you to do it. When in doubt, propose (call the tool).
  - ONLY when the merchant sends a bare, content-free acknowledgement — just "yes" / "ok" / "confirm" /
    "done" with no action named — right after you proposed something, do NOT call the tool again; briefly
    point them to the Confirm button on the card you just showed.
  - If they ask "is it done / did it work?", do NOT re-propose. Say that if they tapped Confirm it's
    already applied (you don't see their taps), and OFFER to check the current state with a read tool.

How to behave:
- Multi-step goals: if the merchant states a GOAL that needs several steps (e.g. "get my shop ready to
  sell", "launch this product", "fix everything that's blocking sales"), first look up the current state
  with a read tool (needs_attention / check_readiness), then propose ALL the actions needed to reach the
  goal in one go — each becomes its own confirmation the merchant can approve together. Don't stop after
  one step when the goal clearly needs more. Then close with a one-line summary of what you've queued.
- Only take an action the merchant actually asked for (or that clearly serves the goal they stated). If a
  request is ambiguous (which product? how much?), ask one short question instead of guessing.
- If an action can't be prepared (e.g. refunding an unpaid order), the tool tells you why — relay that
  plainly and suggest the fix.
- Be concise and warm, like a sharp shop manager. This renders in a small chat panel: a sentence or two,
  then a tight list if needed. No markdown headers.
- Lead with the answer. Money: show amounts in the store currency; the shop uses whole units (no cents).
- If a tool returns an error, tell the merchant what went wrong in plain language — never expose internals.

DASHBOARD LINKS: when the merchant must do something in the dashboard that you cannot do with a tool (or that is clearly better done there), tell them in one line and include a markdown link [click here](/dashboard/<route>) to the exact page. Prefer a link over describing a menu path — never say "go to Settings -> X". Use these real routes:
- Store details (name, logo, address): /dashboard/settings/store
- Guided setup wizard (products, delivery, payments): /dashboard/setup
- Payments / enable a payment method: /dashboard/setup
- Shipping & delivery options: /dashboard/settings/shipping-profiles
- Stock locations / ship-from: /dashboard/settings/locations
- Regions & currencies: /dashboard/settings/regions
- Custom domain: /dashboard/domains
- Storefront theme / design: /dashboard/design
- Products: /dashboard/products
- Orders: /dashboard/orders
- Billing & credits: /dashboard/billing
- Marketing: /dashboard/marketing
- Ads: /dashboard/advertising
- AI call center: /dashboard/calls
- Blog: /dashboard/blog
`.trim()

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "not authorized" })
  }

  const body = (req.body ?? {}) as {
    message?: string
    history?: Array<{ role?: string; content?: string }>
    conversation_id?: string
  }
  const message = String(body.message ?? "").trim().slice(0, 4000)
  // Full-page assistant passes a conversation_id → durable history. The floating
  // panel omits it and stays ephemeral. Ownership is checked before any persist.
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id
      ? body.conversation_id
      : null

  // ---- SSE headers ----
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  let closed = false
  req.on?.("close", () => {
    closed = true
  })
  // A broken pipe (client vanished mid-stream) surfaces as an ASYNC 'error' on
  // the response stream, not a throw. Without this listener an unhandled stream
  // error can bubble to uncaughtException and take the process down.
  ;(res as any).on?.("error", () => {
    closed = true
  })
  const send = (event: string, payload: unknown) => {
    if (closed) return
    try {
      res.write(`event: ${event}\n`)
      res.write("data: " + JSON.stringify(payload) + "\n\n")
    } catch {
      closed = true
    }
  }

  if (!message) {
    send("error", { message: "say something and I'll help." })
    return res.end()
  }

  // Attribute this run's AI cost (Langfuse trace) to the REAL merchant, not the
  // unset boot-time TENANT_ID — otherwise every Pixi turn lands on "Platform".
  const provider = getAiTextProvider(ctx.tenant.id)
  if (!provider?.supportsTools || !provider.runTools) {
    send("error", { message: "The assistant isn't configured on this store yet." })
    return res.end()
  }

  const meta = ctx.tenant.meta ?? {}
  // The system message is a byte-stable constant (see CACHE-STABILITY INVARIANT
  // above): per-store facts + remembered notes are NOT folded into it. They ride
  // in a per-turn "Store context" block prepended to the user message, so the
  // cached system+tools prefix stays identical across turns, conversations AND
  // tenants, letting Novita's auto-cache serve the ~66-tool schema near-free.
  const storeContext =
    `Store context: name="${ctx.tenant.name || "merchant"}", ` +
    `country=${meta.default_country || "unknown"}, ` +
    `currency=${(meta.currency_code || "").toUpperCase() || "unknown"}.`
  // Fold in this shop's remembered notes so Pixi carries context across
  // sessions (tenant-scoped recall — only ever this store's notes).
  const notes = await loadNotes(req, ctx.tenant.id).catch(() => [])
  const system = SYSTEM
  // Notes travel with the per-turn store context (NOT in the cached prefix).
  const storeContextWithNotes = storeContext + notesForPrompt(notes)

  // Compact multi-turn context. For a persisted conversation the history comes
  // from the DB (tenant-scoped, authoritative); the ephemeral panel sends its own.
  let convOwned = false
  if (conversationId) {
    const conv = await getConversation(req, ctx.tenant.id, conversationId)
    convOwned = !!conv
  }
  const history = convOwned
    ? await historyForPrompt(req, ctx.tenant.id, conversationId as string, 8)
    : Array.isArray(body.history)
    ? body.history.slice(-6)
    : []
  const convo = history
    .filter((h) => h?.content)
    .map((h) => `${h.role === "assistant" ? "Pixi" : "Merchant"}: ${String(h.content).slice(0, 800)}`)
    .join("\n")
  const basePrompt = convo ? `${convo}\nMerchant: ${message}` : message
  // Prepend the per-turn store context so it sits AFTER the cached system+tools
  // prefix (keeping that prefix byte-identical) while the model still receives
  // live per-store facts and remembered notes.
  const prompt = `${storeContextWithNotes}\n\n${basePrompt}`

  // Persist the user's turn now (so a mid-run disconnect still records it), and
  // title the conversation from its first message.
  if (convOwned && conversationId) {
    await saveMessage(req, ctx.tenant.id, conversationId, "user", message)
    await maybeTitle(req, ctx.tenant.id, conversationId, message)
  }

  // Accumulate what happened this turn so the assistant message can be replayed.
  const toolTrail: Array<{ label: string; name: string }> = []
  const confirmTrail: Array<{ summary: string; action: string; tier: string }> = []

  const { definitions, run } = buildJarvisTools(req, ctx as any)
  const tools = [...definitions, ...WRITE_DEFINITIONS]

  const labelFor = (name: string) =>
    TOOL_LABELS[name] ?? WRITE_LABELS[name] ?? name

  // ---- JARVIS OS card-stream helpers (additive; local to this route) ----
  // These power the new `tool_call` / `tool_result` SSE frames that the Pixi OS
  // card UI binds to. They are strictly additive — the existing `tool`/`confirm`/
  // `message` frames are untouched, so current consumers keep working.
  const CARD_MAX_BYTES = 32 * 1024

  // Shallow-sanitize model-authored tool args for display: depth 1, primitives
  // only, long strings truncated. Args carry no secrets today (never internal
  // context/tokens), but keep them small and safe regardless.
  const sanitizeArgs = (args: any): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    if (!args || typeof args !== "object") return out
    for (const [k, v] of Object.entries(args)) {
      if (v == null) out[k] = v
      else if (typeof v === "string")
        out[k] = v.length > 500 ? v.slice(0, 500) + "…" : v
      else if (typeof v === "number" || typeof v === "boolean") out[k] = v
      else if (Array.isArray(v)) out[k] = `[${v.length} items]`
      else if (typeof v === "object") out[k] = "[object]"
      // functions/symbols dropped
    }
    return out
  }

  // Cap a tool result for the wire: if it serializes past CARD_MAX_BYTES, shrink
  // arrays (the usual culprit — long order/product lists) and flag it. Always
  // returns a JSON-serializable, bounded value.
  const capData = (value: unknown): unknown => {
    let json: string
    try {
      json = JSON.stringify(value)
    } catch {
      return { _unserializable: true }
    }
    if (json.length <= CARD_MAX_BYTES) return value
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        return { _truncated: true, _count: value.length, items: value.slice(0, 10) }
      }
      const shrunk: any = {}
      for (const [k, v] of Object.entries(value)) {
        shrunk[k] = Array.isArray(v) ? v.slice(0, 10) : v
      }
      shrunk._truncated = true
      try {
        if (JSON.stringify(shrunk).length <= CARD_MAX_BYTES) return shrunk
      } catch {
        /* fall through to stub */
      }
    }
    return { _truncated: true, _note: "result too large to display" }
  }

  // Emit a card-stream frame without ever risking the main stream: pre-serialize
  // in a guard so a bad payload throws HERE (caught) instead of inside send(),
  // where a throw would flip the shared `closed` flag and kill the whole stream.
  const emitCard = (event: string, payload: unknown) => {
    try {
      JSON.stringify(payload)
      send(event, payload)
    } catch {
      /* never break the stream over an optional card frame */
    }
  }

  const execute = async (call: AiToolCall): Promise<unknown> => {
    const label = labelFor(call.name)
    toolTrail.push({ label, name: call.name })

    // ---- WRITE tool: propose, never execute here ----
    if (isWriteTool(call.name)) {
      send("tool", { id: call.id, name: call.name, label, state: "running" })
      emitCard("tool_call", {
        id: call.id,
        name: call.name,
        label,
        kind: "write",
        args: sanitizeArgs(call.arguments ?? {}),
      })
      const w = WRITE_BY_NAME[call.name]
      const args = (call.arguments ?? {}) as Record<string, any>

      let planned: any
      try {
        planned = await w.plan(req, ctx as any, args)
      } catch (e: any) {
        planned = { ok: false, error: "I couldn't prepare that change." }
      }
      if (!planned || planned.ok === false) {
        send("tool", { id: call.id, name: call.name, label, state: "error" })
        return { error: (planned && planned.error) || "couldn't prepare that action" }
      }

      let signed: { token: string; exp: number }
      try {
        signed = signPlan({
          tid: ctx.tenant.id,
          action: call.name,
          args: planned.apply_args,
          tier: w.tier,
          requireText: w.tier === "hard" ? w.requireText || "" : undefined,
          summary: planned.human_summary,
        })
      } catch (e) {
        send("tool", { id: call.id, name: call.name, label, state: "error" })
        return { error: "the assistant isn't fully configured to make changes yet" }
      }

      send("confirm", {
        id: call.id,
        action: call.name,
        tier: w.tier,
        require_text: w.tier === "hard" ? w.requireText || "" : null,
        summary: planned.human_summary,
        details: planned.details ?? {},
        token: signed.token,
        exp: signed.exp,
      })
      confirmTrail.push({
        summary: planned.human_summary,
        action: call.name,
        tier: w.tier,
      })
      send("tool", { id: call.id, name: call.name, label, state: "done" })

      // Tell the MODEL it's now the merchant's move so it stops and closes out.
      return {
        proposed: true,
        awaiting_merchant_confirmation: true,
        summary: planned.human_summary,
        note: "Prepared and shown to the merchant for confirmation. Do NOT call this again; briefly tell them it's ready for their confirm.",
      }
    }

    // ---- READ tool (existing behaviour) ----
    send("tool", { id: call.id, name: call.name, label, state: "running" })
    emitCard("tool_call", {
      id: call.id,
      name: call.name,
      label,
      kind: "read",
      args: sanitizeArgs(call.arguments ?? {}),
    })
    const result = await run(call) // run() never throws (handlers catch)
    const errored = !!(result && typeof result === "object" && (result as any).error)
    send("tool", {
      id: call.id,
      name: call.name,
      label,
      state: errored ? "error" : "done",
    })
    emitCard("tool_result", {
      id: call.id,
      name: call.name,
      label,
      ok: !errored,
      data: errored ? null : capData(result),
      error: errored ? (result as any).error : null,
    })
    return result
  }

  send("thinking", { ok: true })

  try {
    const outcome = await provider.runTools(prompt, {
      system,
      tools,
      execute,
      feature: "jarvis",
      temperature: 0.3,
      // Higher round budget so Pixi can chain a look-up plus several proposals
      // when the merchant states a multi-step goal (P4 autonomy).
      maxRounds: 6,
      maxTokens: 800,
    })
    const answer =
      outcome.text || "I couldn't find an answer for that — can you rephrase?"
    send("message", { text: answer })
    if (convOwned && conversationId) {
      await saveMessage(req, ctx.tenant.id, conversationId, "assistant", answer, {
        tools: toolTrail,
        confirms: confirmTrail,
      })
    }

    // COST INVARIANT: the Pixi text loop is the heaviest recurring LLM surface
    // (up to `maxRounds` Kimi-K2 completions per message, each shipping the full
    // tool schema). It must NOT bill zero. Meter it POST-PAID for the ACTUAL
    // rounds used, attributed to the real merchant (ties into the tenant fix):
    // one `ai_text` unit per completion round, exactly like a 3-round content
    // generation bills 3. This is fail-open by design — the answer has already
    // been streamed, so a metering error (or an empty wallet) can never break
    // the chat; it is only logged. The registry's `meterInstanceCall` wrapper is
    // a passthrough in pooled prod, so this is the ONLY charge (no double-meter).
    try {
      const rounds = Math.max(1, Number(outcome.rounds) || 1)
      const metered = await meterAction(
        req.scope,
        ctx.tenant.id,
        "ai_text",
        1,
        async () => ({ result: null, actualUnits: rounds })
      )
      if (!metered.ok) {
        // Out of credits: the turn already answered (fail-open). Log only.
        // eslint-disable-next-line no-console
        console.warn(
          `[jarvis] tenant ${ctx.tenant.id} out of credits — text turn unbilled (${rounds} rounds).`
        )
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[jarvis] text metering failed (non-blocking):", e?.message ?? e)
    }

    send("done", { rounds: outcome.rounds, conversation_id: conversationId })
  } catch (e: any) {
    send("error", { message: "Something went wrong on my end. Try again in a moment." })
    // eslint-disable-next-line no-console
    console.error("[jarvis] run failed:", e?.message ?? e)
  }
  return res.end()
}
