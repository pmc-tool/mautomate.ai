# P0 Multi-Tenant Isolation Audit — brandtodoor (Medusa v2 backend)

Date: 2026-07-18
Scope: READ-ONLY audit of `apps/backend/src/api/**` (merchant/store/admin/telephony/webhooks), the CMS/Jarvis modules, and tenant-scoping helpers. Threat model: pooled multi-tenant (shared DB, tenant separated by `tenant_id` + sales_channel). Catastrophic class = one merchant reading/writing/affecting another merchant's data/revenue. ~200 merchant routes audited + store overrides, telephony bridge, CMS write path, Jarvis text+voice, middlewares.

Baseline (verified correct): `resolveMerchant(req)` (`api/merchant/_helpers.ts`) derives the tenant ONLY from `req.auth_context.actor_id` (set by `authenticate("merchant")` middleware), requires `status==="active"`, and loads the tenant from `merchant.tenant_id`. No route was found taking `tenant_id`/`sales_channel_id` from the request body/query/header. The vast majority of by-id routes correctly gate on ownership before read/write. The findings below are the exceptions.

---

## P0 — CRITICAL

### P0-1 — Cross-tenant storefront price manipulation via price-list creation
File: `apps/backend/src/api/merchant/price-lists/route.ts` — `resolveVariantPriceSets` (lines 44-61), POST handler (lines 105-133).

Vulnerable pattern — client-supplied `variant_id`s are resolved to `price_set_id`s with NO tenant/sales-channel ownership filter:
```ts
// resolveVariantPriceSets — global lookup, no tenant scope
const { data: links } = await query.graph({
  entity: "product_variant_price_set",
  filters: { variant_id: variantIds } as any,   // ANY tenant's variant accepted
  fields: ["variant_id", "price_set_id"],
})
// POST — creates an ACTIVE (client-controlled status) price list whose price
// rows attach to the resolved price_set_id; only the LIST is tagged tenant_id
prices: parsed.data.prices.map((p) => ({ amount: p.amount, currency_code: p.currency_code, price_set_id: map[p.variant_id] })),
metadata: { tenant_id: ctx.tenant.id },   // scopes VISIBILITY only, not the target price_set
```
Exploit: Merchant A reads competitor B's variant IDs (exposed publicly by the storefront `/store/products` API), then `POST /merchant/price-lists` with `status:"active"` and a price row `{ variant_id: <B's variant>, amount: 1 }`. A price list with no rules applies to that price_set for all price calculations, so this injects an override into B's live storefront prices — set them to 1 (destroy margin) or huge (block sales). Direct write to another tenant's revenue, exploitable with publicly-observable IDs. (Contrast: the promotions rule-value path DOES validate every id is tenant-owned via `invalidTenantRuleValue`; price-lists has no equivalent.)
Fix: before `resolveVariantPriceSets`, verify every `variant_id` belongs to a product linked to `ctx.tenant.meta.sales_channel_id` (the same `product_sales_channel` gate used by gift-cards/promotions), rejecting any foreign/unknown variant fail-closed. The PUT path does not add prices and is unaffected.

---

## P1 — HIGH

### P1-1 — Credit top-up trusts client `credits` decoupled from `amount_usd` (self-underpayment, platform financial loss)
Files: `apps/backend/src/api/merchant/credits/route.ts` (POST, lines 110-111); grant in `apps/backend/src/api/webhooks/payment/stripe/route.ts` (`checkout.session.completed`, lines 146-147).

Vulnerable pattern — both values come from the body and are only independently clamped; no server check that `amount_usd == credits/100`:
```ts
const credits   = Math.max(1, Math.min(1000000, Math.floor(Number(body.credits) || 0)))
const amountUsd = Math.max(1, Math.min(10000, Number(body.amount_usd) || Math.ceil(credits / 100)))
```
The card is charged `amountUsd`, but the webhook grants the metadata `credits` verbatim (`await ledger.credit(event.tenant_id, event.credits, ...)`) and never recomputes from the amount paid.
Exploit: `POST /merchant/credits { credits: 1000000, amount_usd: 1 }` charges $1 and grants 1,000,000 credits (~$10,000 of platform value; ~10,000x underpayment). Credits buy real-cost goods (AI call minutes, phone rentals, domains). NOT cross-tenant (grant is correctly bound to the caller's own `tenant_id`) — this is self-service financial fraud. Precondition: a live Stripe gateway (billing may currently be gated off; exploitable the moment it goes live).
Fix: derive the charge from credits server-side (`amount_usd = credits/100`, ignore client `amount_usd`), OR have the webhook grant `round(amount_paid_usd * 100)` credits instead of trusting `metadata.credits`; reject mismatched requests.

---

## P2 — MEDIUM

### P2-1 — Stored cross-tenant category injection via `POST /merchant/product-categories` `parent_id`
File: `apps/backend/src/api/merchant/product-categories/route.ts` (parent handling ~line 140; list serializer `serializeCategory` ~lines 42-56).

Vulnerable pattern — `parent_id` is trusted verbatim on create (the `[id]` update route and reorder route both DO validate it via `loadOwnedCategory`):
```ts
parent_category_id: parent_id || undefined,   // never verified tenant-owned
metadata: { tenant_id: ctx.tenant.id },
```
Exploit: Merchant A creates an A-owned category with `parent_id` = a tenant B category id; the node is inserted as a child of B's category. The list serializer renders `category_children` recursively WITHOUT a tenant filter (only top-level rows are tenant-filtered), so B's admin category tree AND B's public storefront nav (`GET /store/product-categories` renders `category_children` for owned parents) now show A's attacker-named node; A can also read B's parent category name/handle back. Precondition: attacker must know a victim category ULID (opaque, not exposed cross-tenant), lowering practical risk.
Fix: on create, if `parent_id` is set, resolve it and reject unless `metadata.tenant_id === ctx.tenant.id` (reuse `loadOwnedCategory`). Also filter `category_children` by `tenant_id` in both the merchant list serializer and the store route (defense in depth).

### P2-2 — SSRF via server-side fetch of client-controlled image URL
Files: `apps/backend/src/api/merchant/ads/ai/image/route.ts` (~lines 32-42), `ads/ai/video/route.ts` (~lines 25-31), `blog/ai/image/route.ts` (~lines 75-79) → `apps/backend/src/modules/marketing/ads/ai.ts` `toInlinePart` (~line 274, `const r = await fetch(url)`).

Vulnerable pattern — URL accepted if it merely `startsWith("http")`, then fetched server-side:
```ts
const productImageUrl = typeof b.product_image_url === "string" && b.product_image_url.startsWith("http") ? b.product_image_url : null
// ...later, server-side: const r = await fetch(url); if (!r.ok) throw new Error(`... (${r.status})`)
```
Exploit: any authenticated merchant points this at internal hosts (`http://127.0.0.1:3010` Langfuse, Umami, `http://169.254.169.254/...` cloud metadata, other loopback services). The body is forwarded to the AI provider (not reflected), but the propagated HTTP status in the error message is a semi-blind SSRF oracle for internal port/endpoint probing. Not a cross-tenant data leak.
Fix: allowlist fetched URLs to the tenant's own media/CDN host; reject private/loopback/link-local IPs after DNS resolution; do not echo upstream status codes.

---

## P3 — LOW (reference-injection / integrity / availability; no demonstrated cross-tenant data breach)

- P3-1 `draft-orders/route.ts` POST (~line 82): `customer_id: body.customer_id` trusted without tenant validation; the detail GET returns `order.customer.first_name/last_name`, so a foreign customer id yields a name read-back. Gated by opaque ULIDs. Fix: validate the customer belongs to the tenant before assigning.
- P3-2 `products/route.ts` POST: `tag_ids` (~318), `collection_id`/`collection_ids` (~456), `category_ids` (~458), `type_id` (~455) trusted verbatim. Product is correctly created into the tenant's own sales channel + stamped, so no rogue catalog injection, but a known foreign org-id can be linked and its `collection.title`/`type.value`/`tags.value` read back via the list. Fix: validate each ref's `metadata.tenant_id` (the legacy tags-by-value path is already scoped).
- P3-3 `blog/posts/route.ts` POST (~142-143) & `blog/posts/[id]/route.ts` PUT (~112-118): `author_id`/`category_ids` trusted verbatim (post itself is `loadPost` tenant-checked). Relation expansion returns another tenant's author (name/bio/avatar/slug) + categories, and renders them on the storefront. Fix: run `loadAuthor`/`loadCategory` (which enforce tenant) on the inputs.
- P3-4 `fulfillment-providers/route.ts` GET: client `location_id` used to read `stock_location.fulfillment_providers` with no `locationTenantId` check. Providers are global/uniform (`manual_manual`) so no secret exposed. Fix: gate on `locationTenantId(...) === ctx.tenant.id`.
- P3-5 `tax-regions/[id]/tax-rates/route.ts` & `.../[rateId]/route.ts` `validateRules`: `product`/`product_type` refs are tenant-checked, but the allowed `shipping_option` reference is not. Rule only fires in the owning tenant's own cart — no constructible leak. Fix: validate `shipping_option` refs or drop from the enum.
- P3-6 `apps/backend/src/api/telephony/tool-execute/route.ts`: when no call row is found for `call_id`, the tenant falls back to the client-claimed `body.tenant_id` (Ava call-center path only; the Jarvis branch requires `call.playbook_id==="jarvis"`, so a missing/foreign row never reaches Jarvis writes). Behind the `x-telephony-secret` timing-safe gate, so exploitation needs the shared telephony secret. Defense-in-depth. Fix: reject (200 `{error}`) when no call row anchors the tenant instead of trusting the claim.
- P3-7 Fetch-all-then-filter with fixed caps (fail-closed, availability-at-scale only, NOT a leak): `returns|exchanges|claims/route.ts` (`getTenantOrderIds` take:1000), `refund-reasons|return-reasons/route.ts` (take:2000), `shipping-profiles/route.ts` (take:200), `store/collections|product-categories` (take:1000). A tenant's own rows beyond the cap silently disappear (and the returns/exchanges/claims membership check can 404 a legitimately-owned order). Fix: filter by tenant in the query, or page to exhaustion.
- P3-8 Marketing integrity (not isolation): `conversations/[id]/route.ts` catch-all POST (~630-643) writes `status`/`assigned_user_id` without the enum/active-tenant-user validation the dedicated `/status` and `/assign` routes apply; `posts/route.ts` POST/PUT + `posts/generate` persist `campaign_id`/`brand_voice_id` without the `assertReferences` check the agents route uses. Both only write to the caller's own already-owned rows; no cross-tenant surfacing. Fix: mirror the dedicated-route validation.

---

## VERIFIED SOLID (regression-checked known-risky areas + core surfaces)

- Jarvis text chat (`jarvis/route.ts`): tenant from `resolveMerchant`; conversation ownership checked via `getConversation(tenant.id, id)`; notes/history tenant-scoped; the new `tool_call`/`tool_result` SSE frames carry only sanitized args + tenant-scoped read-tool data (writes never execute here). SOLID.
- Jarvis HMAC plan-token (`jarvis/_plan-token.ts` + `apply/route.ts`): dedicated `JARVIS_PLAN_SECRET` (fail-closed if unset/short), HMAC-SHA256, timing-safe compare, expiry; apply re-checks `plan.tid === ctx.tenant.id` (tenant-bound), hard-tier typed word, and single-use via atomic `jarvis_audit` nonce claim before the action runs. SOLID.
- Jarvis money writes (`jarvis/_writes-money.ts`): `apply()` re-resolves the frozen `order_id` scoped to `ctx.tenant.meta.sales_channel_id` (hard tenant backstop) — the model cannot move money on a foreign order. SOLID.
- Jarvis VOICE bridge (`jarvis/_voice.ts`, `voice/start|stop|pending`, `telephony/tool-execute` Jarvis branch): tenant is anchored on the call row by `voice/start` from the authenticated merchant session; `tool-execute` re-derives the AUTHORITATIVE tenant from the call row (Jarvis branch requires the row to exist); reads run tenant-scoped, writes are PROPOSED only (same tenant-bound plan token, recorded in `jarvis_voice_pending`, applied only by a human tap via `/apply`). `voice/pending` and `voice/stop` are tenant-scoped/ownership-checked. Jarvis memory/chat (`_memory.ts`, `_chat.ts`) filter every read/write by `tenant_id`. SOLID.
- CMS write path (`modules/cms/tenant-scope.ts` `requireWriteTenant`): signed merchant identity wins (pak may only agree, else reject); secret-gated storefront proxy; operator admin — fail-closed, never a shared/default tenant. Used by all `/cms/visual-*` and `/admin/cms/*` writes. `cms/visual-publish` additionally refuses to publish over a page owned by a different store. SOLID (regression of the prior "CMS built without tenant_id" leak — fixed).
- Editor token (`merchant/cms/visual-editor/route.ts`): `mintEditorToken` embeds `t: tenantId` (HMAC-signed), and the route refuses to open the editor on a storefront whose `resolved.tenant_id !== ctx.tenant.id`. SOLID (regression of the prior editor-token cross-tenant leak — fixed). NOTE: storefront-side verification of the token's `t` binding lives in the Next.js app (`/api/editor-auth`) and was out of backend scope — recommend a follow-up read there.
- Store CMS reads (`store/cms/pages/[slug]`, blog, settings): tenant from publishable key via `cmsTenantId`, fail-closed 404 on unresolved tenant. Store catalog overrides (`store/collections`, `store/product-categories`) filter by `metadata.tenant_id` fail-closed. SOLID.
- Order money/fulfillment mutations (cancel/capture/refund/mark-paid/fulfill/deliveries/shipments/edit/update/notes/returns-receive): every one performs a `query.graph({entity:"order", filters:{ id, sales_channel_id: scId }})` ownership pre-check (404) before any workflow. SOLID.
- Call recordings (`call-center/calls/[id]/recording/route.ts`): call `tenant_id` verified before streaming + path-traversal guard (`[^a-zA-Z0-9_]` stripped) — no cross-tenant PII/recording access. Phone-number buy/attach, agents, knowledge, transfers, erasure all tenant-scoped. SOLID.
- Products/inventory/categories/tags/types/collections/stock-locations/reservations: by-id ownership via `product_sales_channel` or `metadata.tenant_id`, fail-closed (except P2-1/P3-2 create-path org-FK gaps). Shipping (fulfillment set/zone/option) walks the ownership chain to `stock_location.metadata.tenant_id`. Domains: every op gates on `findOwnedDomain` (tenant_id + domain_name) — no domain-hijack path. Marketing (51 routes incl. the customer inbox): every by-id load asserts `tenant_id`; no unfiltered lists. Ads/promotions/discounts/campaigns/gift-cards: tenant-scoped (except P0-1). SOLID.
- Per-store customer isolation (middlewares): emailpass auth identifier namespaced `<tenant>:<email>` (fail-closed on unresolved tenant); `/store/customers` stamps `metadata.tenant_id`; `/store/customers/me` refuses a token replayed against a different store. Telephony perimeter: `x-telephony-secret` timing-safe, fail-closed. SOLID.
- Injection/secrets: `whereRaw` uses are parameterized (`?` bindings) or static; no dynamic SQL string interpolation. No hardcoded live secrets (only Stripe key-format help text). SOLID.

## NEEDS A DEEPER LOOK (out of this pass's scope)
- Storefront Next.js `/api/editor-auth` — confirm it enforces the editor token's `t` (tenant) binding against the serving host (backend mints it correctly; consumer side unverified here).
- Stripe/payment webhook signature verification depth (only the credit-grant logic was inspected — see P1-1).
- The "core-flows node_modules patch" (per prior work, applied for per-store handle/SKU/email uniqueness) was not located in `src/`; confirm it is still applied after any Medusa reinstall/upgrade.
- Pooled shared-customer model: a customer entity that ordered at two pooled stores is editable by BOTH tenants (via `customerBelongsToTenant`'s order-derived ownership). This is the documented pooled model, not an IDOR, but worth a product decision.

## RANKED FIX ORDER
1. P0-1 price-list variant ownership (cross-tenant live-price write; publicly-observable IDs).
2. P1-1 credit top-up amount/credits binding (platform financial loss on Stripe go-live).
3. P2-1 category parent_id ownership + child-serializer tenant filter; P2-2 image-URL SSRF allowlist.
4. P3 reference-injection validations (draft-order customer_id, product/blog org-FKs), telephony no-call-row hardening, and the fetch-all pagination caps.
