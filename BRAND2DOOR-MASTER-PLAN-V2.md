# Brand2Door — Master Fix & Completion Plan (V2)

> Status: PLAN for alignment. No feature code changes until approved.
> Source of truth: the VM `/home/ratul/brandtodoor` (+ `/home/ratul/console`). The local `medusa-develop` is upstream Medusa + reference only.
> Author: consolidated from a 5-agent read-only discovery sweep (2026-07-07).
> Prime directive (user): production-grade, no tenant bleeding, nothing half-done. External keys (Stripe / Twilio / ElevenLabs / Deepgram + 1 more) arrive later — plan around them, don't block.

---

## 0. What we actually have (ground truth from discovery)

Two things are true at once:
1. The **backends are rich** — real data models, tenant scoping, a genuinely mature marketing journey engine, credits ledger, encrypted config vault, provisioning, scale-to-zero.
2. The **frontends and the authoring/write surface are thin** — many merchant-admin pages are dead (missing client functions) or **mock stubs that never call the backend** (fake data, lost writes), and most "create/edit" flows for marketing, call-center, regions, and store settings don't exist.

Plus there are **multi-tenant DESIGN conflicts** (globally-unique Medusa keys) that the earlier access-control hardening did not and could not fix, and **infra instability** (Redis Sentinel) that makes healthy code look broken.

### Architecture reminder (two store generations — this drives several decisions)
- **Pooled tenants** (demo-store, sam, cignet, shofy, …): managed through the shared control-plane backend `b2d-backend:9500` via `/merchant/*` routes, isolated by `sales_channel_id` / `metadata.tenant_id`. **Globally-unique Medusa keys (tax region per country, promotion code) CONFLICT here** because all pooled tenants share one Medusa instance/DB.
- **Dedicated-instance tenants** (acme, …): own Medusa instance + own DB + full `/app` admin. Global-uniqueness is per-instance = per-tenant = already safe.
- Super-admin = the **Operator Console** at `superadmin.brandtodoor.com` (served by pm2 `b2d-console` from `/home/ratul/console/dist`).

---

## 1. Consolidated findings (by area, with severity)

### A. Merchant-admin frontend ↔ backend contract (CONFIRMED broken live)
- **11 missing client functions** in `apps/storefront/src/lib/merchant-admin/api.ts` → 4 fully dead pages + orders-detail action crashes: `listReturns`, `createReturn`, `createExchange`, `createClaim`, `listPriceLists`, `createPriceList`, `getPriceList`, `updatePriceList`, `deletePriceList`, `listDraftOrders`, `createDraftOrder` (+ 5 missing type exports). Backend routes for all of these already exist. This is the cause of the `(0,x.listPriceLists) is not a function` errors.
- **8 mock-stub functions** that never call the backend (fake data / silent lost writes): `getCustomer`, `listCustomerGroups`, `createCustomerGroup`, `getStoreSettings`, `updateStoreSettings`, `listCurrencies`, `createRegion`, plus static option lists. Customer detail shows a fabricated "Alex Morgan"; creating a group/region does nothing; currency save is a no-op.
- Unguarded `toFixed` on discounts pages (null → crash), and two create forms with no loading guard.

### B. Multi-tenant correctness (DESIGN conflicts beyond access-control)
- **Regions list leak (HIGH):** `/merchant/regions` GET does `listRegions({})` → returns EVERY tenant's regions. (Was deferred as low-pri in the Phase-2 access audit; it is a real leak.)
- **Tax-region global-uniqueness (HIGH):** Medusa enforces one tax region per country per instance → first pooled tenant to claim "US" blocks all others.
- **Promotion-code global-uniqueness (HIGH):** promo codes are unique per instance → two pooled tenants can't both use "SAVE10".
- **Product tags/types pollution (MEDIUM):** created globally with no tenant tag; need `metadata.tenant_id` + `query.graph` filter (same fix pattern as categories; reconcile with the Phase-2 partial fix).
- NOTE: prior "Phase 2 safe to ship" covered cross-tenant ACCESS (read/write/delete of another tenant's rows) and holds. These are a different class: shared global NAMESPACES. They only affect **pooled** tenants.

### C. Currency / region / pricing (the reported "currency didn't change")
Three-link failure: (1) store-settings currency UI is a pure mock with no backend route; (2) no route mutates a tenant's Region currency; (3) variant prices are hardcoded `currency_code: "usd"`, and the storefront `force-cache` + in-memory region map wouldn't refresh anyway. All three must be fixed for a currency change to show.

### D. Theme system
- **"Only 2 themes" = data, not code:** registry, catalog, and audit all show 9; the Demo Store tenant was seeded `allowed_themes:["learts","aurora"]`. 37/39 tenants are unset (correctly show all 9).
- **No super-admin entitlement UI:** backend routes exist (`/admin/platform/tenants/[id]/entitlements`, `/themes`) but nothing calls them → stale allow-lists go unnoticed.
- **No-CSS / customization-dead (structural):** `apps/storefront/src/app/layout.tsx` renders a bare `<body>` — no `bodyClassName`, no `data-theme`, no `--ff-*` vars → body-scoped theme CSS + admin color/font customization silently fail on interior pages (store/PDP/cart/account).
- `theme_key` vs `active_theme` drift on some tenants; audit-themes not gated when building via raw `npx next build`.

### E. Marketing automation
- **Chatbot create impossible:** no POST route (route is GET-only → 404), no create form, no client fn. Model + service method exist underneath.
- **Journey engine is mature but unreachable:** real runner + action executor + event enrollment + typed step schema exist; the create form has no step-builder and POST drops `steps`.
- Campaigns / posts / email templates are **list-only** (GET), no create/edit.
- `segments / seo / messaging / studio` modules exist backend-only, unexposed.

### F. AI call center
- **Agent training is a 3-field stub:** create sends only `{name, use_case, voice:"alloy"}`; there is **no agent `[id]` detail/edit page at all**, so an agent can never be opened or trained. Rich `definition` schema (persona, prompts, states, tools, guardrails, voice) exists but is never populated.
- No knowledge-base model/upload for call agents; playbooks/campaigns/calls are list-only; no version publish; no test-call.
- Reference target = calldone's template wizard + 6-tab agent editor (General/Performance/Tools/Knowledge/Phone/Test-Call).

### G. Medusa parity depth (merchant admin)
- **Real inventory does not exist** — stock is a `variant.metadata.inventory_quantity` hack, not Medusa inventory items/levels; no reservations.
- Orders: fulfill/refund/cancel exist; missing order edits, shipment ship/deliver, receive-return, manual capture, notes/timeline, edit email/address, claim/exchange-from-order.
- Returns has a page (once wired); **claims & exchanges have working backends but no UI**.
- Products: missing options edit, add/remove variants post-create, per-variant deep edit, metadata, per-variant currency prices, media-per-variant.
- Categories: no detail/edit, no tree reorder, no category→products.
- Draft orders: can't add real products/shipping/discounts or convert to order.
- Shipping configuration (profiles/options/service zones/provider assignment) entirely absent.

### H. Super-admin & infra/ops
- **Super-admin is mostly WORKING** — packages, blogs, integrations vault, theme images all landed from the stopped terminal; all 17 sections' backend routes return 200.
- **Redis Sentinel unreachable (HIGH, likely root of "application errors"):** `b2d-backend` error log flooded with `All sentinels are unreachable`; 3 restarts; can cause intermittent 500s everywhere.
- **`admin@brandtodoor.com` login broken (401);** use `ops@brandtodoor.com / OpsDrive123` meanwhile.
- **Dead/misleading hostnames:** admin/app/panel.brandtodoor.com → dead ports (502). Only superadmin.brandtodoor.com is the real console.
- **Two orphan super-admin panels** to remove: `/home/ratul/control-admin/`, `/home/ratul/_disabled_admin_routes/platform/`.
- **CRITICAL OPS RISK: the console frontend SOURCE is not on the VM — only `console/dist`.** Any console UI change needs the source (locate/reconstruct) + off-box build + rsync. Must be resolved before super-admin UI work.

---

## 2. Phase plan (each phase = agent squad; security gate every phase)

Ordering = dependency + risk. Rule: a phase isn't done until (a) its checklist passes, (b) a tenant-isolation regression check passes, (c) it's rebuilt/deployed and verified live.

### PHASE 0 — Stabilize, consolidate, get build-ready  [FOUNDATION, do first]
Goal: stop the instability and confusion; make deploys repeatable.
- Fix Redis Sentinel connectivity for `b2d-backend` (or fail over to a single Redis) — kill the intermittent 500s.
- Repair `admin@brandtodoor.com` auth identity (reset password/identity).
- **Locate or reconstruct the Operator Console source** (only `dist` on VM) — check local `my-store`, backups, and the `console/dist` for a recoverable source; establish an off-box build→rsync runbook.
- Remove orphan panels (`control-admin/`, `_disabled_admin_routes/platform/`); fix or retire dead hostnames (admin/app/panel.brandtodoor.com) so only superadmin.brandtodoor.com represents the super-admin.
- Pre-campaign backup (pg_dump + code snapshot). Document the build recipe (backend `.env`-restore gotcha; `next build` vs audit-themes; tenant-instance restarts after shared build).
- Squad: 1 infra/ops agent + 1 build/deploy agent. Blocked-on-keys: none.

### PHASE 1 — Multi-tenant correctness (the "no bleeding" gate)  [SECURITY]
Goal: close the shared-namespace conflicts for pooled tenants; re-verify the whole boundary.
- Regions: scope `/merchant/regions` to the tenant (or move region mgmt platform-side) — kill the list leak.
- Tax regions: resolve global-uniqueness (namespacing per tenant, or platform-scope tax config, or per-tenant override strategy) — DECISION A below.
- Promotions: namespace promo codes per tenant (e.g. internal `t_<tenant>_<code>` with display code unchanged) or per-tenant lookup — DECISION A.
- Product tags/types: `metadata.tenant_id` tag + `query.graph` filter (reconcile with Phase-2 partial fix).
- Full cross-tenant regression re-audit (A vs B tenants) after changes.
- Squad: 2 security/backend agents + 1 adversarial re-audit agent. Blocked-on-keys: none. GATES all later feature work.

### PHASE 2 — De-mock the merchant admin (make what exists REAL)
Goal: no fake data, no lost writes; every existing page actually works.
- Add the 11 missing client functions (+ types) → revive returns, price-lists (list/create/detail), draft-orders (list/create), and orders-detail return/exchange/claim.
- Convert the 8 mock stubs to real, tenant-scoped fetches (customer detail, customer-groups, currencies; region + store settings land in Phase 3).
- Guard all unguarded `toFixed`/null sites; add loading/error guards to create forms.
- **Add a client-runtime smoke test** (render each page in a headless browser or hit each client fn) so this class never regresses — the earlier SSR-only sweep missed exactly this.
- Squad: 2 frontend agents + 1 contract-test agent. Depends on: P0. Blocked-on-keys: none.

### PHASE 3 — Currency, regions & pricing (the reported bug, done right)
Goal: a merchant currency change reflects on the storefront.
- Real `PUT /merchant/store` (default + supported currencies) and a tenant-scoped region-currency mutation route.
- Per-currency variant pricing in product create/edit (remove hardcoded USD; price per enabled currency).
- Storefront reads region/currency from tenant config; invalidate `regions` cache tag + in-memory region map on change.
- Squad: 1 backend + 1 frontend + 1 storefront agent. Depends on: P1 (region scoping), P2 (de-mock store settings). Blocked-on-keys: none.

### PHASE 4 — Merchant Medusa-parity depth (the big commerce phase; sub-waves)
Goal: Shopify/Medusa-grade merchant operations, tenant-safe.
- 4a Orders depth: edits, shipment ship/deliver, receive-return, manual capture, notes/timeline, edit email/address.
- 4b Returns/Claims/Exchanges full UI (backends exist).
- 4c Product depth: options edit, add/remove variants post-create, per-variant deep edit, metadata, media.
- 4d Real inventory: replace the metadata hack with Medusa inventory items + levels per location; reservations.
- 4e Categories depth + draft-order completion + shipping configuration.
- Squad: 4-5 parallel agents by sub-area, each with a tenant-isolation check. Depends on: P1-P3. Blocked-on-keys: none.

### PHASE 5 — Theme system completion
Goal: themes and customization work everywhere; super-admin controls entitlements.
- Structural layout fix: apply `bodyClassName` + `data-theme` + `--ff-*` vars in `layout.tsx` (fixes no-CSS + customization-dead on interior pages).
- Build the super-admin theme-entitlement UI (backend exists) into the Operator Console.
- Fix Demo Store entitlement data + find the seed that set 2; resolve `theme_key`/`active_theme` drift; gate audit-themes in CI.
- Squad: 1 storefront + 1 console agent. Depends on: P0 (console source). Blocked-on-keys: none.

### PHASE 6 — Marketing authoring (self-contained)
Goal: merchants can actually build marketing.
- Chatbot create (POST route + form + client fn) — the reported blocker.
- Journey step-builder UI + persist `steps` + edit/activate/enroll (unlocks the existing engine).
- Create/edit routes + forms for campaigns, posts, email templates.
- Decide keep/defer segments/seo/messaging/studio.
- AI copy/generation paths stubbed behind a flag (wired in Phase 9 with OpenAI key).
- Squad: 2 agents (one authoring UI, one write routes + journey builder). Depends on: P1. Blocked-on-keys: partial (AI generation later).

### PHASE 7 — Call-center authoring & training (self-contained now, voice later)
Goal: merchants can create and TRAIN agents like calldone.
- Agent `[id]` detail/edit page (tabbed: prompt/persona, voice config, tools, states) writing the rich `definition`; `PUT` agent + `playbook_version` publish.
- Knowledge-base model + file upload (storage now; embeddings/RAG in Phase 9).
- Call campaign create + target list; playbook edit.
- Test-call/voice/dialing stubbed (Phase 9).
- Squad: 2 agents. Depends on: P1. Blocked-on-keys: partial (voice/RAG later).

### PHASE 8 — Super-admin completion & design polish
Goal: zero gaps, consistent pro design (the original super-admin session's goal).
- Live re-verify packages/integrations post-Redis-fix; complete any half-wired section; REST symmetry (GET packages).
- Design-consistency pass to match the merchant dashboard quality.
- Squad: 1-2 console agents. Depends on: P0 (console source), P5 (entitlement UI). Blocked-on-keys: Stripe for real billing (Phase 9).

### PHASE 9 — External integrations  [BLOCKED ON USER KEYS]
Wire when keys arrive; each is isolated so it slots in without touching the above:
- Stripe: real billing/MRR, checkout, subscriptions, dunning.
- OpenAI: marketing AI copy, chatbot replies, KB embeddings/RAG.
- ElevenLabs / Deepgram: TTS / STT voices.
- Twilio + voice runtime: outbound dialing, live + test calls.
- Cloudflare-for-SaaS: live custom-domain SSL.
- Squad: 1 agent per integration as keys land.

### PHASE 10 — Production hardening & full E2E
Goal: sign-off.
- MemoryStore→Redis sessions; remove dead routing/code; observability, backups, CI gates (incl. tenant-isolation gate + client-runtime smoke).
- Full E2E: signup→shop→login→every page→product→checkout, cross-tenant isolation regression, security scan.
- Squad: 1 E2E/QA agent + 1 hardening agent.

---

## 3. Decisions needed before we start (my recommendations)

**DECISION A — pooled global-uniqueness (tax regions + promo codes).** For pooled tenants sharing one Medusa instance, these keys collide. Options:
- A1 (recommended): namespace internally per tenant (store the real code/country, prefix the underlying Medusa key with the tenant id; display unchanged) + `metadata.tenant_id` filter. Keeps pooled model cheap, closes the conflict. Most engineering.
- A2: move tax config platform-side (operator sets per-country tax; merchants don't) — simpler, less merchant control.
- A3: push tenants that need tax/promo depth onto dedicated instances (where it's already safe) — aligns with the enterprise tier, but costs more per store.
Recommendation: A1 for promo codes, A2 for tax regions (tax is usually a platform/compliance concern anyway).

**DECISION B — Operator Console source.** Only `dist` is on the VM. Before any super-admin UI work (P5/P8) we must recover or reconstruct the source. Recommendation: P0 agent hunts local `my-store`/backups first; if unrecoverable, reconstruct from `dist` + the known section list (it's a finite, well-understood React app).

**DECISION C — sequencing.** Recommendation: P0 → P1 (security gate) → P2 (de-mock) as the first three, non-negotiable, because everything else is unsafe or unreliable without them. Then P3–P8 can partly parallelize. P9 waits on keys. Confirm you're happy with this order, or reprioritize (e.g. if marketing/call-center is more urgent than parity depth).

---

## 4. How we run each phase
1. I spin up the phase's agent squad (file-disjoint, matched to the findings above).
2. Agents edit only; I do one central rebuild per phase (backend + storefront/console as needed) with the `.env`-restore + tenant-restart precautions.
3. A dedicated adversarial agent runs the tenant-isolation regression + the phase's functional checklist against the real A/B tenants.
4. Verify live, update the memory + this doc, report, then start the next phase.

Nothing ships on a red security gate.
