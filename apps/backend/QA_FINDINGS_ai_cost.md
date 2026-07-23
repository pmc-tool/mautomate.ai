# QA Findings — AI Cost, Metering & Calculations

Auditor: senior cost/metering review. Scope: apps/backend, apps/voice-agent, apps/console, apps/storefront. READ-ONLY audit; no fixes applied.
Deployment reality verified on the live VM (192.168.200.201, pm2 `mautomate`, backend `.env` via Medusa `loadEnv`):
- `PLATFORM_ENABLED=true`  → `meterAction`/`withCredits` metering is ACTIVE.
- `TENANT_ID` UNSET, no per-tenant instances → `meterInstanceCall` (registry meter) is a PURE PASSTHROUGH.
- `LANGFUSE_ENABLED=1`, keys set, `b2d-langfuse-*` containers UP on 127.0.0.1:3010 → the super-admin AI Usage page is live (memory note "instrumentation HELD" is now stale).

Money model: **1 credit = $0.01** (`CREDIT_USD`). Credit columns are integers; `creditsFor` uses `Math.ceil`.

---

## P0 — Real money leak

### P0-1  Credit top-up price is fully client-controlled (buy unlimited credits for $1)
- `src/api/merchant/credits/route.ts:110-111`
```
const credits   = Math.max(1, Math.min(1000000, Math.floor(Number(body.credits) || 0)))
const amountUsd = Math.max(1, Math.min(10000, Number(body.amount_usd) || Math.ceil(credits / 100)))
```
- `src/modules/platform/billing/provider.ts:158,165` — the checkout charges the client's `amount_usd` and stores the client's `credits` as metadata:
  `unit_amount: input.amount_usd * 100` … `metadata.credits: String(input.credits)`.
- `src/api/webhooks/payment/stripe/route.ts:146-152` — on payment it grants exactly `event.credits` as `source:"topup"` (NEVER expires).
- **Issue:** `credits` and `amount_usd` are both taken from the request body with **no server-side check that they correspond to a real pack** (or even to the $0.01 peg). A merchant can POST `{ credits: 1000000, amount_usd: 1 }`, pay **$1**, and receive **1,000,000 non-expiring credits = $10,000 of platform value**.
- **Impact:** Direct, unbounded arbitrage against every AI/comms feature. Worst case ~$9,999 loss per $1 transaction, repeatable.
- **Fix:** Derive `amount_usd` SERVER-side from the requested credits against an authoritative pack/price table (like `subscribe` does with `TIERS`); reject any (credits, amount) pair that doesn't match a known pack. Never trust `body.amount_usd`. Additionally have the webhook re-derive/verify credits from the paid amount.

---

## P1 — Wrong / misleading calculations

### P1-1  Super-admin per-merchant AI COST mis-attributed to "Platform" (margin column wrong for all non-voice AI)
- `src/modules/marketing/ai/registry.ts:75,92,117` — every text/image/video provider is traced with `{ tenantId: process.env.TENANT_ID }`.
- `src/modules/marketing/ai/langfuse-trace.ts` stamps that value as trace `metadata.tenant_id`; `src/api/admin/platform/ai-usage/route.ts:138` (`tenantOf`) reads it back.
- **Issue:** In pooled prod `process.env.TENANT_ID` is UNSET, so the tenant is bound once at module load, not per request. Every marketing / Jarvis / image / video trace carries `tenant_id = undefined` → attributed to **"Platform"** (null tenant). Meanwhile REVENUE for the same actions is correctly per-tenant (from `usage_event.tenant_id`). Net result: every real merchant shows revenue with **cost 0 (≈100% margin)**, and "Platform" shows a large cost with no revenue (hugely negative). Voice is the ONLY correctly-attributed surface (voice passes the real `tenant_id` from the call params — `apps/voice-agent/bot.py:1105-1107`).
- **Impact:** The per-tenant/per-feature margin table — the whole point of the page — is unreliable for everything except voice.
- **Fix:** Thread the request's real tenant into `getAiTextProvider(tenantId)` / trace ctx (pass through `opts.feature`-style), instead of reading a boot-time env var.

### P1-2  Merchant Billing "used this cycle" + usage breakdown silently EXCLUDES all voice spend
- `src/api/merchant/billing/overview/route.ts:104` — `if (t.type !== "commit" || !t.action) continue`.
- **Issue:** Voice settles post-paid via `ledger.clawback(...)` (`src/api/telephony/call-ended/route.ts:103`), which writes a `clawback` tx, NOT a `commit`. The overview loop only counts `commit` rows, so **AI call minutes are omitted from `used_this_cycle` and from the per-feature usage list** on the Billing page. (The separate `GET /merchant/credits` page DOES include clawback at line 57, so the two merchant pages disagree.) The wallet balance is still correct — only the reporting under-counts.
- **Impact:** Merchant sees a smaller "used this cycle" and no voice line item; allowance-consumption is understated. Confusing/under-transparent, not a money loss.
- **Fix:** Include `type in ('commit','clawback')` in the overview aggregation (mirror credits/route.ts).

### P1-3  `/admin/platform/margin` presents flat price-book ESTIMATES as "real gross margin"
- `src/api/admin/platform/margin/route.ts:8-12,35,47` — cost = `sum(usage_event.vendor_cost_usd)`; header comment: *"this is not a model or a forecast: it is the real gross margin ... from real traffic."*
- **Issue:** `usage_event.vendor_cost_usd` is written from `vendorCostFor(action, units)` = the **static blended constant** in `price-book.ts` (e.g. voice = flat $0.03/min regardless of real STT/TTS/LLM/Daily). It is an estimate, labeled as real, and it will NOT agree with the Langfuse-backed `/ai-usage` page (which is the actual token/vendor cost). Two P&L pages with two different cost bases are surfaced to the super-admin.
- **Impact:** Truthfulness/trust: margins look precise but are model-based; the two pages contradict each other.
- **Fix:** Relabel `/margin` as an estimate/forecast, or drive its cost from the same Langfuse source as `/ai-usage`; pick ONE authoritative P&L.

---

## P2 — Missing metering (silent cost leak)

### P2-1  Jarvis text chat LLM turns are UNMETERED
- `src/api/merchant/jarvis/route.ts:161` (`getAiTextProvider()`), `:386` (`maxRounds: 6`). No `meterAction`/`withCredits`/`getLedger` anywhere in the chat route or `_chat.ts`.
- **Issue:** The chat loop's only meter is the registry `meterInstanceCall` wrapper, which is a passthrough in pooled prod (TENANT_ID unset — `src/modules/platform/integration/instance-meter.ts:72`). Each merchant message runs **up to 6 Kimi-K2 (Novita) completions**, each shipping the **full ~66-tool schema** (`[...definitions, ...WRITE_DEFINITIONS]`, route.ts:208; ~66 unique tools counted). All free to the merchant. Only the *approved write action* (`/apply`) meters its specific action; the conversation itself does not.
- **Impact:** The heaviest recurring LLM surface on the platform bills zero credits. Real vendor cost per active merchant with no revenue offset (and, per P1-1, it's also mis-attributed in cost visibility).
- **Fix:** Wrap `provider.runTools` in `meterAction(scope, tenantId, "ai_text", 1, … actualUnits = rounds)` like `marketing/posts/generate` does.

### P2-2  Post-call extraction LLM unmetered + untraced
- `src/api/telephony/extract/route.ts` calls `chat/completions` directly; no meter, no Langfuse trace.
- **Impact:** Per-call LLM cost invisible to both credits and super-admin cost page.

### P2-3  RAG embeddings unmetered + untraced
- `src/modules/call-center/knowledge/embedding.ts` — embedding generation with no meter/trace.
- **Impact:** Knowledge-base indexing vendor cost is a silent leak (small per call, unbounded on large uploads/re-index).

### P2-4  Admin "sparkle" text generator unmetered
- `src/api/admin/marketing/generate-text/route.ts` — inline improve/shorten/expand/translate; calls the content engine with no `meterAction`.
- **Impact:** Editor sparkle actions are free vendor calls.

### P2-5  The registry `meterInstanceCall` path is DEAD in pooled prod
- `src/modules/marketing/ai/registry.ts` wraps text/image with `meterInstanceCall`, which requires `TENANT_ID + PLATFORM_CONTROL_URL + PLATFORM_METER_SECRET` (instance-per-tenant). Only 2 of 3 are set. Any feature that relies SOLELY on the registry meter (raw `getAiTextProvider().generate` / `getAiImageProvider().generate` without a surrounding `meterAction`) is unmetered — e.g. `content-service`, `studio/image-service`, `messaging/ai-reply` when not called through a metered caller. NOTE: most merchant routes (`marketing/posts/*`, `ads/ai/*`, `blog/ai/*`, `jarvis/_writes-*`, `auto-reply`) DO wrap with `meterAction` and ARE metered; this finding is about the raw provider path + the surfaces in P2-1..P2-4.

---

## P3 — Optimization / minor calc

### P3-1  Email batch counter is in-memory, not DB (comment is false)
- `src/modules/marketing/email/send-service.ts:125-145` — `const emailBatchCounter = new Map()`; comment claims *"The counter lives in the DB (usage rows), so restarts can't be used to dodge it."* It does not. Resets on every process restart and is per-worker, so up to 9 emails/tenant/restart are never charged. Dollar impact negligible (email ≈ $0.0001) but the claim is wrong and it's cluster-unsafe.

### P3-2  Two divergent pack price tables
- `price-book.ts:150` PACKS (1000→$12, 5000→$50, 15000→$135, 50000→$400) vs `billing/overview/route.ts:28` PACKS (1000→$10, 2750→$25, 6000→$50, 13000→$100). The overview page displays its own table; purchase (P0-1) trusts the client entirely. No single source of truth for pack pricing.

### P3-3  Two divergent plan definitions
- `subscribe` (`TIERS` in price-book) and the Stripe webhook grant (`planFor` → `TIERS`) use CODE prices/credits, but `billing/overview` + `change-plan` DISPLAY from `listPlatformPackages` (DB). If the DB rows drift from `TIERS`, the merchant sees one credit allowance but is granted another.

### P3-4  Top-up `unit_amount` not rounded
- `provider.ts:158` `unit_amount: input.amount_usd * 100` (the subscription path uses `Math.round`). Fractional `amount_usd` yields a non-integer cents value.

### P3-5  Latent double-metering if instance mode is ever enabled
- Routes that call `meterAction(... "ai_ad_campaign"/"ai_content" ...)` AND internally call `getAiTextProvider()` would, once `TENANT_ID` is set, ALSO charge `ai_text` via the registry `meterInstanceCall` — double billing. Harmless today (passthrough) but a trap for the SaaS rollout.

---

## Cost-reduction opportunities (rough impact)

1. **Meter + trim the Jarvis tool payload (biggest lever).** ~66 tools × up to 6 rounds/message. Novita auto-caches the stable system+tools prefix, so *within-conversation* turns get the cache discount — but the first turn of every conversation and any cache miss pays full rate on the whole schema (multiple thousand tokens). Route by intent to a 10-15 tool subset, and/or lower `maxRounds` for simple queries. Also keep the system+tools prefix byte-identical/ordering-deterministic so Novita cache hits are reliable. Estimated 40-70% input-token reduction on Jarvis turns.
2. **Model selection.** Kimi-K2 serves even trivial `ai_text` sparkle/rewrite/grammar. A small/cheap model (gpt-4o-mini or a small Novita model) suffices for those; reserve Kimi for tool-calling/agentic paths.
3. **Prompt caching everywhere.** Voice already models Novita's prefix cache correctly. Confirm the text path's system prompt is stable and placed first so the auto-cache applies; the approximate-cache assumption (turns ≥2 hit the prefix) is reasonable for Novita.
4. **Already-good wins to keep:** pre-recorded/cached TTS (`tts_cache.py` + Jarvis phrase warm cache → ~$0 TTS on cached phrases), STT skipped on the realtime S2S path, Piper self-hosted TTS at $0.

---

## What is SOLID

- **Ledger core** (`credits/ledger.ts`): atomic reserve → commit/release, idempotency keys collapse webhook retries, TTL reaper for stranded reservations, credit lots with soonest-expiry-first burn, purchased (`topup`) credits never expire. `creditsFor` uses `Math.ceil` → no silent fractional rounding.
- **Voice metering math is now correct:** the ~6x LLM turn over-count is FIXED via frame-id dedup (`langfuse_tracing.py` `_first_time`, one observation per unique `MetricsFrame`); the Novita prompt-cache discount is modeled (`_price_llm_turn`, turn-1 full rate, cached prefix thereafter); STT/TTS/Daily/LLM are each priced and attributed to the REAL tenant.
- **Subscriptions are real Stripe** (`mode:"subscription"`, monthly recurring); plan price is server-derived from `TIERS` (client only picks the key) — no client-price trust on the subscription path.
- **Partner/referral commission** cents math is correct (`Math.round`, integer-cents ledger).
- **Webhook idempotency** on the Stripe event id prevents double-grants.
- **Active metered paths** (PLATFORM_ENABLED=true): cms/ai-*, ads/ai/*, blog/ai/* + blog-autopilot, marketing/posts/*, marketing auto-reply, ads autopilot, agent-runner, setup/logo, telephony/call-ended — all correctly gate the vendor call on wallet balance.

## Honest state of super-admin cost visibility
Langfuse is deployed and live (contra stale memory). Voice spend is real and per-tenant. But **per-merchant cost for all non-voice AI is mis-attributed to "Platform" (P1-1)**, so per-tenant margins are currently unreliable for everything except voice. **Two P&L pages** (`/margin` = flat estimates labeled "real"; `/ai-usage` = real Langfuse cost) contradict each other. **Extract + embeddings cost is invisible** (P2-2/2-3). Net: the page is *available and truthful for voice*, but *incomplete and per-merchant-inaccurate for the rest* until the tenant-attribution and the two untraced surfaces are fixed.
