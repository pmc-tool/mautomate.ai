# JARVIS OS — Architecture & Build Spec

> The authoritative contract for rebuilding the Jarvis "stage" into a full-screen
> AI **orchestration** interface: a center mA core that spawns dynamic **tool
> cards** connected by glowing signal lines. Every build agent follows this file.
> All paths are relative to `/home/ratul/brandtodoor` on the VM unless noted.
>
> Status of the current system: fully working voice+text agent with an SSE
> tool-loop, a WebGL orb, and a confirm/write gate. What is MISSING for the card
> UI is a single thing — the stream does not currently surface tool **arguments**
> or tool **result data** to the browser. Section 1 specifies the minimal backend
> change that unlocks everything else.

---

## 0. File map (what exists today)

Frontend (`apps/storefront`):
- `src/components/merchant-admin/jarvis-stage/jarvis-stage.tsx` — full-screen voice overlay (~1400 lines). Owns the SSE fetch loop, Daily real-voice, confirm affordances.
- `src/components/merchant-admin/jarvis-stage/jarvis-core.tsx` — the WebGL orb (`JarvisCore`).
- `src/components/merchant-admin/jarvis-stage/jarvis-launcher.tsx` — bottom-right floating pill; mounts `<JarvisStage>`; listens for window events.
- `src/components/merchant-admin/jarvis-panel.tsx` — the text chat panel (~1000 lines). Same SSE protocol, renders `ConfirmCard`/`ProposedCard`.
- `src/lib/merchant-admin/use-jarvis-voice.ts` — browser STT/TTS hook.
- `src/modules/cms/editor/design.ts` — **the design system** (ink + ember, Inter).
- `src/app/dashboard/layout.tsx` — mount point (`<JarvisPanel/>` + `<JarvisLauncher/>`).

Backend (`apps/backend/src/api/merchant/jarvis`):
- `route.ts` — `POST /merchant/jarvis`, the SSE tool-loop. **This is where the new events must be emitted.**
- `_chat.ts` — conversation/message persistence (Postgres, tenant-scoped).
- `_tools.ts` — core read tools + `buildJarvisTools(req, ctx)` registry + `TOOL_LABELS`.
- `_reads-brand.ts`, `_reads-catalog.ts`, `_reads-content.ts`, `_tools-insights.ts`, `_tools-ops.ts`, `_tools-more.ts`, `_tools-connect.ts` — more read tools.
- `_attention.ts` — `computeAttention()` (powers `needs_attention` + the attention strip).
- `_writes.ts` — write registry (`WRITE_BY_NAME`, `WRITE_DEFINITIONS`, `WRITE_LABELS`, `isWriteTool`).
- `_writes-money.ts` (refund/capture/cancel/mark_paid), `_writes-catalog.ts`, `_writes-content.ts`, `_writes-brand.ts`, `_writes-marketing.ts`, `_writes-social.ts`, `_writes-ads.ts`, `_writes-settings.ts`, `_writes-soft.ts`, `_writes-extra.ts` — write executors.
- `_plan-token.ts` — HMAC plan token (`signPlan`/`verifyPlan`/`planNonce`).
- `apply/route.ts` — `POST /merchant/jarvis/apply` (the only place a write executes).
- `attention/route.ts` — `GET /merchant/jarvis/attention`.
- `_voice.ts`, `voice/*` — Daily real-voice (start/stop/pending).

---

## 1. Streaming / tool protocol (THE contract) — and the one change needed

### 1.1 How the frontend calls Jarvis

**SSE-over-POST via `fetch` + a manual `ReadableStream` reader** (not `EventSource` — because it must POST a body with the bearer token and message). Identical in both `jarvis-stage.tsx` and `jarvis-panel.tsx`:

```ts
const resp = await fetch("/merchant/jarvis", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,   // merchant session token
  },
  body: JSON.stringify({
    message,
    history: historyRef.current.slice(0, -1),  // [{role,content}], last ~6 turns
    // conversation_id?: string  // only the full-page assistant passes this → durable history
  }),
  signal: ac.signal,
})
const reader = resp.body.getReader()
const dec = new TextDecoder()
let buf = ""
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  let i
  while ((i = buf.indexOf("\n\n")) >= 0) {     // frames split on blank line
    const frame = buf.slice(0, i); buf = buf.slice(i + 2)
    let ev = "message", data = ""
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) ev = line.slice(6).trim()
      else if (line.startsWith("data:")) data += line.slice(5).trim()
    }
    const payload = data ? JSON.parse(data) : {}
    handleEvent(ev, payload)
  }
}
```

Frames are standard SSE: `event: <name>\n` then `data: <json>\n\n`. The backend writer (`route.ts`):

```ts
const send = (event, payload) => {
  res.write(`event: ${event}\n`)
  res.write("data: " + JSON.stringify(payload) + "\n\n")
}
```

SSE headers set in `route.ts`: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `res.flushHeaders()`. Broken-pipe safe (`req.on("close")` + `res.on("error")` set a `closed` flag).

### 1.2 The EXACT events emitted TODAY

From `route.ts` (in loop order):

| event | payload | when |
|---|---|---|
| `thinking` | `{ ok: true }` | run started |
| `tool` | `{ id, name, label, state: "running" \| "done" \| "error" }` | a tool call started / finished |
| `confirm` | `{ id, action, tier: "soft"\|"hard", require_text: string\|null, summary, details: {}, token, exp }` | a WRITE was proposed (never executed) |
| `message` | `{ text }` | the final natural-language answer |
| `done` | `{ rounds, conversation_id }` | run finished |
| `error` | `{ message }` | run failed |

Exact emit sites in `route.ts` `execute(call)`:

```ts
// READ tool:
send("tool", { id: call.id, name: call.name, label, state: "running" })
const result = await run(call)                     // <-- RESULT IS NEVER STREAMED
const errored = !!(result && (result as any).error)
send("tool", { id: call.id, name: call.name, label, state: errored ? "error" : "done" })
return result                                       // <-- only the MODEL sees `result`

// WRITE tool (propose):
send("tool", { id: call.id, name: call.name, label, state: "running" })
const planned = await w.plan(req, ctx, args)        // no mutation; resolves ids, validates
const signed = signPlan({ tid, action: call.name, args: planned.apply_args, tier: w.tier,
                          requireText, summary: planned.human_summary })
send("confirm", { id: call.id, action: call.name, tier: w.tier,
                  require_text: w.tier === "hard" ? w.requireText : null,
                  summary: planned.human_summary, details: planned.details ?? {},
                  token: signed.token, exp: signed.exp })
send("tool", { id: call.id, name: call.name, label, state: "done" })
```

### 1.3 VERDICT — what is and isn't surfaced

- **assistant text**: YES, but only as ONE final `message {text}` — there are **no incremental text deltas**. `provider.runTools()` resolves once with `outcome.text`; the stream replays it in a single frame. (Token-level streaming would require a change in the AI provider's `runTools` — out of scope; the card UI does not need it.)
- **tool CALL name**: YES (`tool {name,label}`), but **NOT its arguments**.
- **tool RESULT data**: **NO.** The read result object is returned to the model and dropped. The browser only learns `state: "done"`. **This is the single blocker for card-driven UI.**
- **confirm / plan-token for writes**: YES, fully — `confirm {..., details, token, exp}` already carries the proposed-change data (`details`) and the token. Writes are the one place structured data already reaches the UI.

### 1.4 THE MINIMAL BACKEND CHANGE (required — spec it exactly)

Add two new SSE event types in **`apps/backend/src/api/merchant/jarvis/route.ts`**, inside the `execute` closure. Do **not** touch `_tools.ts`, the AI provider, or `runTools` — `execute` already wraps every tool call and has `call.arguments` and the `result` in hand. This is additive and backward-compatible (existing `tool` frames stay; old clients ignore unknown events).

**A. Emit `tool_call` with args when any tool starts** (both read and write branches). Replace the opening `send("tool", …, state:"running")` with two frames:

```ts
send("tool", { id: call.id, name: call.name, label, state: "running" })
send("tool_call", {
  id: call.id,
  name: call.name,
  label,
  kind: isWriteTool(call.name) ? "write" : "read",
  args: sanitizeArgs(call.arguments ?? {}),   // shallow, string/number/bool only; see note
})
```

**B. Emit `tool_result` with data for READ tools** (right before `return result`):

```ts
const result = await run(call)
const errored = !!(result && typeof result === "object" && (result as any).error)
send("tool", { id: call.id, name: call.name, label, state: errored ? "error" : "done" })
send("tool_result", {
  id: call.id,
  name: call.name,
  label,
  ok: !errored,
  data: errored ? null : result,          // the card renders `data`
  error: errored ? (result as any).error : null,
})
return result
```

Writes need no `tool_result` — their `confirm` frame already carries `details` + `token`. (Optionally also emit `tool_result` for a write with `{proposed:true}` so the card manager can key off one event type; not required.)

Notes / guardrails:
- **`sanitizeArgs`**: cap depth 1, drop functions, truncate long strings (e.g. 500 chars). Args are model-authored and safe to show, but never include secrets — none are passed as tool args today.
- **Size**: some read results are large (e.g. `list_recent_orders` up to 25 orders). That is fine over SSE, but the card should virtualize/scroll. If a result exceeds, say, 32 KB serialized, truncate arrays server-side and add `{ _truncated: true }`.
- The `id` on `tool_call`/`tool_result` is `call.id` — the SAME id used by the existing `tool` frames, so the card manager correlates `tool_call` → `tool` (done) → `tool_result` by `id`.

After this change: the UI receives, per tool, `tool_call {id,name,kind,args}` → `tool {id,state:done}` → `tool_result {id,data}`; per write, `tool_call {id,kind:write}` → `confirm {id,details,token}`. That is the complete event vocabulary the card system consumes.

---

## 2. Tool result data shapes (what each card renders)

All read handlers are tenant-scoped through `ctx` and **never throw** — failure returns `{ error: string }`. Money is in **whole currency units** (no cents). Representative shapes (field names are exact):

### Reads (return data → render directly)

**`check_readiness`** (`_tools.ts checkReadiness`)
```ts
{ ready_to_sell: boolean, percent: number, required_percent: number,
  missing_required: string[],
  tasks: [{ task: string, done: boolean, required: boolean, why: string, blocker: string|null }] }
```

**`store_overview`** (`_tools.ts storeOverview`)
```ts
{ store_name, country: string|null, currency: string, ready_to_sell: boolean|null,
  product_count: number, order_count: number, active_theme: string|null }
```

**`list_recent_orders`** (`_tools.ts`)
```ts
{ count: number,
  orders: [{ order_no, status, payment, fulfillment, total: number, currency,
             customer: string|null, country: string|null, placed_at }] }
```

**`get_order`** (`_tools.ts`) — one order:
```ts
{ order_no, status, payment, fulfillment, total, currency, customer, country, placed_at,
  ship_to: string, phone: string|null, items: [{ title, qty: number }] }
```

**`search_products`** (`_tools.ts`)
```ts
{ count: number, products: [{ title, status, variants: number, variant_names: string[] }] }
```

**`needs_attention`** (`_attention.ts computeAttention`) — the hero card:
```ts
{ ready_to_sell: boolean,
  items: [{ id, severity: "blocker"|"warn"|"info", title, detail,
            cta?: { label, prompt?: string, href?: string } }] }   // sorted blocker→warn→info, max 6
```
`cta.prompt` → send back into Jarvis; `cta.href` → route in the dashboard. This is the richest interactive card.

**`sales_summary`** (`_tools-more.ts salesSummary`)
```ts
{ days, orders: number, revenue: number, aov: number, currency }   // revenue counts only captured orders
```

**`low_stock`** (`_tools-more.ts lowStockList`)
```ts
{ threshold: number, count: number, items: [{ product, variant, available: number }] }  // items ≤ 20, sorted asc
```

**`find_customer`** (`_tools-more.ts findCustomer`) — aggregated customer summary (name/email, order count, spend, recent orders). Returns `{ error }` if no match.

**`visitor_report`** (`_tools-insights.ts`)
```ts
{ available: true, days, visitors, pageviews, visits, active_now,
  top_pages: [{ page, views }], top_sources: [{ source, visits }] }
// OR { available: false, note }
```

**`ad_report`** (`_tools-insights.ts`)
```ts
{ available: true, days, mock: boolean, spend, impressions, clicks, conversions,
  roas: number|null, currency, connected,
  per_campaign: [{ name, status, spend, conversions, roas }] }   // OR { available:false, note }
```

**`compare_ads`** (`_tools-insights.ts`)
```ts
{ available: true, window_days,
  spend: { now, last, change, pct: number|null },
  conversions: {...}, clicks: {...}, impressions: {...}, note }
```

**`call_topics`** (`_tools-insights.ts`)
```ts
{ calls_today: number, by_status: Record<string,number>, top_topics: [{ topic, count }] }
```

Other reads follow the same convention: `domain_status`, `call_center_status`, `inbox_status`, `orders_to_deliver`, `delivery_issues`, `needs_human`, `todays_email`, `list_blog_posts`, `list_pages`, `list_collections`, `list_categories`, `list_discounts`, `list_themes`, `list_campaigns`, `search_domain`. Each returns a plain JSON object (`{available:false, note}` when its subsystem isn't configured). The card renderer should have a **generic fallback** (key/value + arrays-as-tables) plus **bespoke renderers** for the high-value shapes above.

### Writes (propose → confirm → apply)

Write tools do NOT return renderable read data. Instead, at PROPOSE time each `plan()` returns:
```ts
// _writes-money.ts JarvisWrite.plan → 
{ ok: true, human_summary: string, details: Record<string, unknown>, apply_args: Record<string, any> }
// OR { ok: false, error: string }
```
The route folds `human_summary` + `details` into the `confirm` frame. Example `details` shapes:
- `refund_order` (tier **hard**, word `REFUND`): `details: { order_no, amount, currency, ... }`, summary `"Refund <amt> to <customer> on order #<n>."`
- `mark_order_paid` (hard, `PAID`): `details: { order_no, mode, outstanding, currency, captures }`.
- `capture_payment` (hard, `CAPTURE`), `cancel_order` (hard, `CANCEL`).
- `create_discount` (hard, `CREATE`), `create_blog_post` (soft, one-tap draft), `switch_theme` (hard, `SWITCH`), etc.

**Tier drives the card affordance**: `soft` = one-tap Confirm button; `hard` = type-the-word input (`require_text`, e.g. `REFUND`) then Confirm. Full list of write tools + their live labels is in `_writes.ts WRITE_LABELS`.

---

## 3. The confirm / write gate (how a write card behaves)

Two-request handshake; **no LLM runs on apply** (args frozen at propose time). See `_plan-token.ts` + `apply/route.ts`.

1. **Propose** (in the stream): model calls a write tool → `route.ts` runs `w.plan()` (validates + resolves ids server-side, does NOT mutate) → mints a token via `signPlan()`:
   ```ts
   type JarvisPlan = { v:1, tid, action, args, tier, requireText?, summary, iat, exp }
   ```
   HMAC-SHA256 with a dedicated secret `JARVIS_PLAN_SECRET` (fails closed if unset/short). TTL **120 s**. Token = `base64url(plan).base64url(hmac)`. Emitted as `confirm {token, exp, ...}`.

2. **Card renders** (UI): show `summary`; if `tier==="hard"` show an input requiring the exact `require_text` word (case-insensitive), disabling Confirm until it matches:
   ```ts
   const ready = tier !== "hard" || typed.trim().toUpperCase() === require_text.toUpperCase()
   ```

3. **Apply** (on Confirm): POST the token:
   ```ts
   await fetch("/merchant/jarvis/apply", {
     method: "POST",
     headers: { "content-type":"application/json", authorization:`Bearer ${token}` },
     body: JSON.stringify({ token: c.token, confirm_text: typed }),
   })
   ```
   `apply/route.ts` safety layers, in order: (1) `verifyPlan` (HMAC + expiry, constant-time), (2) **tenant bind** — `plan.tid === ctx.tenant.id` (no cross-store replay), (3) hard-tier word re-check, (4) **single-use** — atomic nonce claim into `jarvis_audit` (`onConflict("nonce").ignore().returning()`); a replay claims 0 rows → `409 "That was already done."`. Then `write.apply()` runs; the audit row is updated with the result.

4. **Apply response**:
   ```ts
   { ok: true, action, message, undo: { token, label:"Undo" } | null }
   // OR { ok: false, message }   (200 with ok:false for a clean failure; 4xx for gate rejections)
   ```
   If `undo` is present, render an **Undo** affordance on the completed card; tapping it applies the undo token through the SAME apply endpoint (it's a fresh soft plan token).

**Card status machine for a write**: `pending` → (Confirm) `applying` → `done` (show `message` + optional Undo) | `error` (show `message`, allow retry) | `dismissed` (Not now) | `expired` (token past `exp`; must re-ask). The current stage models this as `status: "pending"|"applying"|"done"|"error"` (`jarvis-stage.tsx` `Confirm` type) — reuse it.

**Voice-proposed writes**: in real-voice mode, writes proposed over the Daily channel are polled via `GET /merchant/jarvis/voice/pending` (3 s interval) and merged into the same confirm list. Keep this path for the new UI (poll → card).

---

## 4. Design system (ink + ember, Inter)

**Source of truth: `apps/storefront/src/modules/cms/editor/design.ts`.** Import tokens from here; do not hardcode hexes. CSS approach is **inline React `CSSProperties` + Tailwind utility classes + occasional scoped `<style>` blocks** (the Jarvis components use all three; the stage uses inline styles + a `StageStyles()` `<style>` block; the dashboard uses Tailwind with the grey ramp). There is no CSS-modules setup for these components. New cards should prefer **inline styles from `design.ts` tokens** for anything themed (colors, radii, shadows, type) and Tailwind for layout.

Key tokens (`design.ts`):

```ts
grey = { 0:#FFFFFF, 5:#F9FAFB, 10:#F3F4F6, 20:#E5E7EB, 30:#D1D5DB,
         40:#9CA3AF, 50:#6B7280, 60:#4B5563, 70:#374151, 80:#1F2937, 90:#111827 }
ink  = { base:#0F1319, raised:#171C24, hairline:#242A33, text:#E7EAEE, muted:#9BA3AF }
accent (ember) = { base:#F26522, hover:#E05A1A, active:#C94D12, tint:#FEF1EA,
                   tintStrong:#FBDCC9, ring:rgba(242,101,34,0.28), soft:rgba(242,101,34,0.10), on:#FFFFFF }
semantic = { successFg:#067647/successBg:#ECFDF3/successBorder:#ABEFC6,
             dangerFg:#B42318/dangerBg:#FEF3F2/dangerBorder:#FECDCA,
             warnFg:#B54708/warnBg:#FFFAEB/warnBorder:#FEDF89, infoFg:#175CD3/infoBg:#EFF8FF }
font = "Inter, -apple-system, ..."   // ONE family
type = { micro(10/600/upper), label(12/500), body(13/400), bodyStrong(13/500), title(14/600), heading(18/600) }
radius = { sm:4, md:6, lg:10, pill:999 }
shadow = { xs, sm, md, lg, chip }
ease = "cubic-bezier(0.2,0.8,0.2,1)";  motion = { fast:120ms, base:160ms, slow:240ms }
focusRing = "0 0 0 3px accent.ring"
```

Primitive style factories to reuse: `button(tone,size)`, `iconButton(size,dark)`, `field()`, `surface(elevation)`, `chip()`, `menuItem()`, `eyebrow()`, `hairline`/`hairlineDark`, `canvas` (selection language). Philosophy from the file header: **"quiet ink chrome, hairline structure, one warm signal"** — ember is spent ONLY on the thing being touched.

**The stage's own palette** (dark immersive context, `jarvis-stage.tsx`): background `#07090D`, `EMBER=#F26522`, `CYAN=#4DD8E6` (listening accent), `WARM=#F5F1EC` (text), `DANGER=#E0645E`. Cards over the dark orb should use dark glass surfaces (`rgba(15,19,25,0.72)` + `backdrop-filter: blur`, ember hairline) as the existing `.jv-stage-confirm` does — NOT the light `surface()` (that's for the light dashboard). Provide a card surface token set for the dark stage that mirrors `design.ts` semantics.

Signal lines / glow: use `accent.base` at low alpha for connectors, `accent.ring`/box-shadow for active glow, matching the mic's `radial-gradient(#FF8A4C, #F26522, #B8410F)` and the orb's ember. Keep CYAN reserved for the "listening/merchant input" meaning it already carries.

---

## 5. The orb / core (`jarvis-core.tsx`) — reusable? YES.

`JarvisCore` is a **single self-contained WebGL fragment-shader orb** with a CSS-radial-gradient fallback. Not a fibonacci particle sphere (that was an earlier iteration) — it's a domain-warped fbm "molten sphere": hot core → gold → ember → deep rim, iridescent shimmer riding the edge, tight bloom halo, kept INSIDE the orb so the field stays clean/dark.

Props (the ONLY inputs — it's fully driven, no internal state):
```ts
type JarvisState = "idle" | "listening" | "thinking" | "speaking"
type JarvisActivity = { id: string, label: string, state: "running" | "done" }
JarvisCore({ state: JarvisState, level: number /*0..1 audio*/, activities?: JarvisActivity[] })
```
- `state` eases shader `uSpeed`/`uLevel`/`uHue` targets (thinking = fast+hot, listening = medium, speaking = medium, idle = slow).
- `level` (0..1) is the audio amplitude → swells/brightens the orb. In the stage it's computed by a `requestAnimationFrame` loop from Web Audio analysers (local mic + remote bot RMS in real-voice; mic RMS + synthetic wave in browser fallback), throttled to ~30 fps.
- `activities` currently only nudges the orb hotter when any is `running` — **the constellation/tool-line rendering is NOT in the orb.** That's the opening for the new design: the orb stays the center core; cards + signal lines are a NEW layer composited around it.

Renders as `absolute inset-0 bg-black` with a full-bleed `<canvas>`. Respects `prefers-reduced-motion` (freezes time, caps level). Cleans up rAF + ResizeObserver + WebGL context on unmount. Handles WebGL-unavailable via the CSS fallback div.

**Reuse verdict: keep `JarvisCore` unchanged as the center core.** It is a clean, prop-driven, dependency-free, performant component. The new orchestration UI is a sibling layer that (a) reads the same derived `state`+`level`, (b) draws tool cards positioned around the orb, and (c) draws glowing signal lines from the orb center to each active card. Do NOT fork the shader.

**Current stage layout & how results show today** (`jarvis-stage.tsx`): full-screen `fixed inset-0 z-[9999]`, orb full-bleed behind, a top bar (state dot + label + close), and a bottom-anchored column: interim caption (CYAN) → single streaming reply `<p>` (`cleanReply`, markdown-stripped) → confirm affordances → controls (hands-free, big mic, stop-speaking) → text input. **There are no per-tool result cards today** — a tool only ticks a label in the panel or nudges the orb in the stage. Everything the tool found is collapsed into the final spoken/typed sentence. The card system replaces this "collapse to one sentence" with "render each `tool_result` as its own card."

---

## 6. Mount point + build / deploy

**Mount**: `apps/storefront/src/app/dashboard/layout.tsx`:
```tsx
import { JarvisPanel } from "@components/merchant-admin/jarvis-panel"
import { JarvisLauncher } from "@components/merchant-admin/jarvis-stage/jarvis-launcher"
...
<JarvisPanel />
<JarvisLauncher />
```
`JarvisLauncher` renders the bottom-right pill and owns `<JarvisStage open={open} onClose>`. Open flow is **window-event driven**:
- pill click → `window.dispatchEvent("jarvis:open")` → `JarvisPanel` (text) opens.
- panel's Voice button → `"jarvis:voice"` → `JarvisLauncher` sets `open` → stage mounts.
- `"jarvis:panel-state" {open}` hides the pill; `"jarvis:attention" {count}` drives the badge.

The new full-screen orchestration UI should slot in as the stage (or a new `jarvis-os.tsx` mounted the same way), reusing this event contract so the launcher/panel wiring is untouched.

**Build/deploy recipe (storefront) — memorize, hard-won:**
```bash
# 0. NEVER two `next build` at once — check first:
pgrep -fl "next build"   # must be empty (a bare "bash" match is just the grep)

# 1. env (brandtodoor FIRST — dual-React bug otherwise):
export NODE_PATH=/home/ratul/brandtodoor/node_modules:/home/ratul/foreverfinds/node_modules
export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
export NODE_OPTIONS=--max-old-space-size=6144

# 2. build (run `next` directly — `yarn` is NOT on PATH; exit 0 REQUIRED here):
cd /home/ratul/brandtodoor/apps/storefront && next build

# 3. postbuild (merges content-hashed chunks so old tabs don't ChunkLoadError):
/home/ratul/bin/sf-postbuild.sh

# 4. restart (PLAIN restart — NO --update-env; preserves runtime NODE_PATH):
pm2 restart b2d-storefront-next

# 5. verify:
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8601/dashboard   # expect 200
```
pm2 ids: `b2d-storefront-next` (14), `b2d-backend` (22). Do **not** touch `ff-*` (that's the separate Forever Finds store).

**Backend deploy** (only if the `route.ts` change from §1.4 is made):
```bash
export NODE_PATH=/home/ratul/foreverfinds/node_modules
export PATH=/home/ratul/foreverfinds/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
cd /home/ratul/brandtodoor/apps/backend && medusa build     # TS2307 errors are COSMETIC (swc emits JS anyway)
cp .env .medusa/server/.env                                  # build WIPES this — restore from canonical .env
pm2 restart b2d-backend --update-env
# wait ~60-90s, then: curl http://127.0.0.1:9500/health  → 200
```
After any route rewrite, grep for **duplicate `const`** declarations (a dup crash-loops the whole backend → all merchant APIs dead; storefronts survive via stale-tenant protection).

**Next 15 / gotchas:**
- **NEVER `rm -rf .next`** — triggers the Next 15 `/404` `_document useContext` build crash; recovery requires the synthesize-prerender-manifest dance. Just re-`next build` over the existing `.next`.
- All dashboard/editor routes are `force-dynamic` (per-tenant, resolves theme/CMS from request headers) — expected; do not try to make them static.
- `ChunkGuard.tsx` in the root layout auto-reloads once on ChunkLoadError (loop-guarded) — safety net for deploys.
- Backend restarts blank storefronts ~30-60 s unless mitigated (middleware serves stale tenant config) — avoid needless backend restarts.

---

## 7. Recommended component architecture (the NEW dynamic card system)

Goal: a full-screen surface with the `JarvisCore` orb centered, tool cards spawning around it connected by glowing signal lines, that stays **adaptive, non-overlapping, and uncluttered** even across a long conversation with many cards — with a **minimize-to-dock** system.

### 7.1 State: a card store keyed by tool-call `id`

Model each tool invocation as a **Card**. Drive the state machine off the SSE events (correlated by `id`):

```ts
type CardKind = "read" | "write" | "note"
type CardStatus =
  | "spawning"    // tool_call received, no result yet  → orb signal-line pulses to an empty/loading card
  | "loading"     // running (tool state:"running")
  | "ready"       // tool_result data arrived (read) — renderable
  | "proposed"    // write confirm arrived — needs confirmation (pending)
  | "applying" | "done" | "error" | "expired" | "dismissed"
  | "minimized"   // collapsed into the dock

type Card = {
  id: string                 // = call.id
  kind: CardKind
  tool: string               // name
  label: string              // human label (TOOL_LABELS/WRITE_LABELS)
  args?: Record<string, any> // from tool_call
  data?: any                 // from tool_result (reads)
  confirm?: { tier, requireText, summary, details, token, exp, status }  // writes
  createdAt: number
  slot: number               // layout order
}
```

Event → transition (in the SSE `handleEvent`):
- `thinking` → clear the previous turn's transient cards (keep dock history if desired), orb → thinking.
- `tool_call {id,kind,args}` → **create** card `spawning`/`loading`; fire a signal line from orb.
- `tool {id,state:"done"|"error"}` → mark loading→(await result) / error.
- `tool_result {id,data,ok}` → card `ready` with `data` (read cards).
- `confirm {id,...,token}` → card `proposed` (write cards), render the confirm affordance.
- `message {text}` → the orb speaks; the assistant sentence renders as a caption/summary bar, NOT a card (or as a special "answer" card pinned near the orb).
- `done` → settle; auto-minimize non-focused cards (see 7.4).
- apply success → card `done` (+ Undo); failure → `error`.

Keep this in a small reducer/`useReducer` or a `useSyncExternalStore` card store inside a `JarvisOSProvider`, so the orb, the card host, and the signal-line layer all read the same source.

### 7.2 Layout: flow-based, NOT absolute — the key to non-overlap + adaptive sizing

**Do not absolutely-position cards around the orb by angle** — that guarantees overlap once N grows and fights small screens. Instead:

- **Orb stays fixed** as a centered, `position: fixed`/`absolute` full-bleed background layer (it already is `inset-0`). It is decorative/ambient; cards float ABOVE it.
- **Cards live in a CSS layout container**, not free space. Recommended: a **responsive CSS Grid** with `grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr))` inside a scrollable region, OR a **masonry-ish flex-wrap column set**. Grid `auto-fill` + `minmax` gives adaptive card widths that reflow to the viewport with **zero overlap by construction** and no manual measuring. Cap card max-width (~420px) and let height be content-driven with an internal `max-height` + `overflow:auto` for long lists (orders, low-stock).
- **Reserve the orb's optical center**: leave the middle column/region empty so the orb reads as the source. Two practical patterns:
  1. **Two side rails**: a left grid and a right grid flanking a center gutter that contains the orb + the live answer caption. Cards fill rails top-to-bottom; the newest/primary card takes the top of the nearest rail. On narrow screens the rails collapse to a single scroll column below the orb (orb shrinks to a header).
  2. **Radial-on-desktop, stack-on-mobile**: desktop places up to ~4-6 cards on a coarse ring using grid areas (fixed named slots, so they never overlap — cards occupy SLOTS, not pixel coordinates); overflow goes to the dock. Mobile is a plain vertical scroll column.
  Prefer pattern (1) — simpler, robustly non-overlapping, adaptive, touch-friendly.
- **Signal lines** are a separate `<svg>`/`<canvas>` overlay (`pointer-events:none`, `position:fixed inset-0`, above orb, below cards). Each active line is drawn from the orb center to the card's measured anchor (read the card DOM rect via a ref + `ResizeObserver`; recompute on layout/scroll/resize). Line style: ember gradient stroke, animated dash or a traveling glow bead while `loading`; steady faint line while `ready`; fade out when minimized. Because cards are laid out by the grid (not by JS position), the SVG only READS positions — it never drives layout, so there's no feedback loop.

### 7.3 CardHost: 1 primary + queued

- **Primary card**: the most recent `ready`/`proposed` card, rendered larger, nearest the orb, with the brightest signal line and full detail. At most ONE primary.
- **Queued cards**: other active cards render at normal size in the rails.
- **Overflow → dock**: beyond a small visible budget (e.g. 3-4 per rail, or whatever fits without scroll on the current viewport — measure with a `ResizeObserver` on the rail), older cards auto-**minimize** into the dock.

### 7.4 Minimize-to-dock (the new hard requirement)

- A **bottom dock** (fixed, full-width, touch-friendly, horizontally scrollable) holds minimized cards as **pills/chips** (icon + tool label + status dot), using `design.ts` `chip()` styling on the dark stage.
- **Auto-minimize policy**: when a new card becomes primary (or on `done`), previously-focused cards animate down into the dock. Only the primary + a couple of context cards stay expanded. This keeps a long conversation from becoming a wall of cards.
- **Click a dock chip → expand** it back to primary; the previously-primary card auto-minimizes (single-expanded-focus model, like a radio group). Others stay docked. This satisfies "click to expand, others auto-minimize."
- **Signal lines** only draw to expanded cards; docked chips get a short stub line or none, to keep the field clean.
- Dock chips are **grouped/collapsible** if very numerous (e.g. "+5 more" overflow chip opens a sheet). Keep chip hit-targets ≥ 40px for touch.
- **Motion**: use `motion.base`/`ease` from `design.ts`; respect `prefers-reduced-motion` (snap instead of animate), matching the orb.

### 7.5 Card renderers

- A `CardShell` (dark-glass surface, ember hairline, header = tool label + status + minimize/close, body = renderer, footer = actions) — one shell, many bodies.
- **Bespoke bodies** for high-value shapes: `NeedsAttentionCard` (list with `cta` buttons → re-prompt or route), `OrdersCard` (`list_recent_orders`/`get_order` table), `SalesCard` (revenue/AOV stat tiles), `LowStockCard`, `VisitorsCard`, `AdReportCard`, `ProductsCard`.
- **Write body** = `ConfirmCard` (reuse the existing tier logic: soft one-tap; hard type-the-word from `require_text`; `applying`/`done`+Undo/`error`), rendering `details` as a labeled diff.
- **Generic fallback** `KeyValueCard` for any tool without a bespoke renderer (render objects as key/value rows, arrays of objects as compact tables). This guarantees every tool_result is at least legible.
- Cards read live-data cta actions back through `send(prompt)` (re-enter the chat loop) or dashboard navigation (`href`).

### 7.6 Integration summary

1. Backend: add `tool_call` + `tool_result` events in `route.ts` (§1.4) — the ONLY backend change.
2. Frontend: new `JarvisOS` surface (fork/extend `jarvis-stage.tsx`) mounted via the existing `jarvis-launcher.tsx` event contract; keep `JarvisCore` as-is; add `JarvisOSProvider` (card store), `CardHost` (grid rails), `SignalLines` (svg overlay), `Dock`, `CardShell` + renderers.
3. Keep the existing streaming loop, confirm/apply flow, voice pipeline, and design tokens; the cards are an additive rendering layer over data that (post-§1.4) already arrives on the wire.

---

## Appendix — Full read-tool inventory (names)

`check_readiness, store_overview, list_recent_orders, get_order, search_products, needs_attention, remember, sales_summary, low_stock, find_customer, inbox_status, domain_status, call_center_status, orders_to_deliver, delivery_issues, needs_human, todays_email, visitor_report, call_topics, ad_report, compare_ads, list_blog_posts, list_pages, list_collections, list_categories, list_discounts, list_themes, list_campaigns, search_domain`

## Appendix — Full write-tool inventory (names, from `_writes.ts WRITE_LABELS`)

`make_product_sellable, setup_delivery, enable_payment_gateway, set_product_price, create_product, restock_variant, set_store_country, set_store_currency, create_ad_campaign, launch_ad_campaign, create_social_post, reply_to_customer, hand_conversation_to_ai, fulfil_order, mark_order_paid, capture_payment, refund_order, cancel_order, create_blog_post, update_blog_post, publish_blog_post, create_page, update_page, publish_page, create_collection, add_products_to_collection, create_category, create_discount, switch_theme, generate_logo, set_logo, connect_domain, schedule_social_post, create_email_campaign`
Hidden (undo-only, not model-callable): `cancel_fulfillment, delete_product, queue_conversation`.
