# Architecture & Code-Quality Audit — brandtodoor monorepo

Read-only staff-level audit. Apps: backend (Medusa v2), storefront (Next.js 15), console (super-admin), voice-agent (Python/pipecat), merchant-app + shopper-app (Flutter).
Severity: **P1** = correctness / fragility risk · **P2** = maintainability · **P3** = cleanup.
Every item includes a concrete path and a one-line action. This is an audit — no code was changed.

---

## TOP CORRECTNESS / FRAGILITY RISKS (fix first)

### P1 — Storefront runtime deps are undeclared; a clean `npm install` breaks the build
`liquidjs` and the entire `@tiptap/*` family (core, react, pm, 12 extensions) are imported in `apps/storefront/src` but are **absent from `apps/storefront/package.json`**. They resolve today only because the app runs against a shared, external, hoisted `node_modules` (`NODE_PATH=/home/ratul/foreverfinds/node_modules`, set in `scripts/deploy-storefront.sh`). Any `npm ci` / clean reinstall / prune will not install them and the build will fail — this is the documented "deps get pruned" gotcha, still live.
- Action: add `liquidjs`, `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, and every `@tiptap/extension-*` actually imported to `apps/storefront/package.json` with pinned versions; stop relying on the foreverfinds hoist for correctness.

### P1 — Money formatting: divergent cents-vs-units contract (100x display-error risk)
Two same-named helpers disagree on the core contract: `apps/storefront/src/lib/utils.ts#formatMoney` divides by 100 (cents), `apps/storefront/src/lib/merchant-admin/utils.ts#formatMoney` does **not** (units). Whichever a caller happens to import silently changes the displayed price by 100x. Across the storefront there are ~8 formatter implementations + 14 inline `Intl.NumberFormat` sites; the Flutter apps add a 3rd/4th divergent copy (`merchant-app/lib/core/widgets/money_text.dart` vs inline in `shopper-app/lib/core/widgets/product_card.dart`), each re-deriving the backend minor-unit convention.
- Action: reconcile the ÷100 discrepancy first (audit who passes cents vs units), then collapse to one `formatMoney(amount, currency, {isCents})` in `apps/storefront/src/lib/util/money.ts`; delete the merchant-admin copy; add a shared Dart money module for both Flutter apps.

### P1 — Swallowed errors in tenant provisioning / signup
Backend has 402 `.catch(() => {})` / `.catch(() => null)` swallows across 196 files plus 12 bare `catch {}`. Several sit on the critical provisioning path where a partial failure vanishes with no log: `apps/backend/src/workflows/platform/provision-tenant.ts:65,69`, `apps/backend/src/workflows/platform/bootstrap-tenant-store.ts:277,281,288`, `apps/backend/src/api/platform/signup/route.ts:83,112`, `apps/backend/src/modules/platform/super-admin.ts:312,316,333`, `apps/backend/src/modules/platform/provider/executor/host.ts:260,307`.
- Action: at minimum log inside every swallow; for signup/provisioning, surface or compensate so a half-provisioned tenant is detectable.

### P1 — Call-center commerce gateway truncates product lookups at 1000
`apps/backend/src/modules/call-center/gateway/medusa-adapter.ts` `tenantProductIds()` reads `product_sales_channel` with a single `take: 1000` and no pagination; a tenant with >1000 products silently gets a truncated set, so phone-order product lookups miss the tail. The marketing sibling was already fixed to paginate — the copies diverged (see duplication below).
- Action: port the paginated loop from `apps/backend/src/modules/marketing/gateway/medusa-adapter.ts`.

### P1 — In-memory OTP store is not multi-instance / restart safe
`apps/backend/src/modules/call-center/otp/otp-service.ts:59` `InMemoryOtpStore` — a code issued on one instance (or before a restart) cannot be verified on another. Self-flagged `TODO(durability)`.
- Action: back OTP with Redis/DB before phone go-live or any horizontal scale.

### P1 — Unbounded autopilot scan (400-row cap) silently drops data
`apps/backend/src/modules/marketing/ads/autopilot.ts:93` reads with `{ take: 400 }` and no pagination; the RAG rankers cap at 400 chunks (`modules/call-center/knowledge/embedding.ts`, `modules/marketing/knowledge/rag.ts`). Beyond the cap, rules/knowledge are ignored with no signal.
- Action: paginate or make the cap explicit + logged; revisit before 10k-tenant scale.

---

## BIGGEST DUPLICATION / CONSOLIDATION WINS

### P2 — Jarvis SSE-over-POST client duplicated 4x
A clean shared helper already exists — `apps/storefront/src/components/merchant-admin/jarvis-stage/os/use-jarvis-stream.ts` (`runJarvisStream`) — but only `os/os-provider.tsx` uses it. Three inline byte-for-byte copies of the reader/decoder/frame-split/event-switch remain (~120 lines + duplicated Bearer-token wiring): `apps/storefront/src/components/merchant-admin/jarvis-panel.tsx` (L187-226), `apps/storefront/src/app/dashboard/assistant/assistant-chat.tsx` (L404-441), `apps/storefront/src/components/merchant-admin/jarvis-stage/jarvis-stage.tsx` (L788-828).
- Action: migrate all three onto `runJarvisStream`; delete the inline loops and their hand-built token headers.

### P2 — Two commerce gateways copy-pasted then diverged (already caused the P1 bug)
`apps/backend/src/modules/call-center/gateway/medusa-adapter.ts` (1458 lines) and `apps/backend/src/modules/marketing/gateway/medusa-adapter.ts` (1220 lines) share 13 identically-named methods (`getOrder`, `cancelOrder`, `findCustomersByPhone`, `tenantProductIds`, `assertOrderInTenant`, `updateOrderMetadata`, …); `commerce-gateway.ts` is duplicated too. The divergence already produced the P1 pagination truncation above.
- Action: extract one shared commerce-gateway module both features consume.

### P2 — `safeEqual()` constant-time compare copy-pasted into 13 files
Identical bodies across all `apps/backend/src/api/cms/*` routes (ai-image, ai-edit, ai-text, ai-video, media, pages, templates, visual-*) plus `api/telephony/twilio/_twilio.ts`.
- Action: one `apps/backend/src/lib/safe-equal.ts` (or reuse `modules/cms/preview-token.ts`).

### P2 — Flutter API-client + auth skeleton copy-pasted across the two apps
`merchant-app/lib/core/api/dio_client.dart` and `shopper-app/lib/core/api/dio_client.dart` share the same `dioProvider` + `BaseOptions` + `InterceptorsWrapper` + `ApiError.fromDio`; each app also has its own `api_error.dart`. pubspec even comments "reused from merchant app".
- Action: factor a shared Dart package (dio scaffold + ApiError + interceptors); apps add only their auth specifics.

### P2 — Two parallel merchant-admin UIs
`apps/backend/src/admin/routes/**` (48 Medusa-admin pages, many 40-60KB: `marketing/flow` 51KB, `marketing/journeys` 47KB, `domains` 46KB, `cms/pages/[id]` 60KB) reimplement the same surfaces as `apps/storefront/src/app/dashboard/**` (100 pages). Per the admin-UX-parity effort the storefront dashboard is the intended replacement, making most of `admin/routes/**` a superseded, still-maintained duplicate surface.
- Action: confirm which surface is canonical; retire/freeze the superseded one rather than dual-maintaining both.

### P2 — CMS AI routes bypass the well-factored AI registry
`modules/marketing/ai/registry.ts` centralizes provider construction + credit metering, but `apps/backend/src/api/cms/ai-image/route.ts` (1188 lines) and `api/cms/ai-edit/route.ts` re-implement raw Novita/Gemini HTTP calls, caching, and image processing inline.
- Action: route CMS AI through the existing registry; extract the sharp/image logic into a service.

---

## GOD-FILES / MIXED CONCERNS (thin-route + component-logic violations)

### P2 — Backend business logic living in route handlers
- `apps/backend/src/api/cms/ai-image/route.ts` — 1188 lines, ~25 inline helpers, 0 workflow usage.
- `apps/backend/src/api/admin/platform/ai-usage/route.ts` — 613 lines, Langfuse + revenue joins inline.
- `apps/backend/src/api/cms/ai-edit/route.ts` (398), `api/telephony/agent-config/route.ts` (419), `api/admin/marketing/brain-analytics/route.ts` (416), `api/merchant/products/route.ts` (520).
- ~400KB of Jarvis tool logic under `apps/backend/src/api/merchant/jarvis/_*.ts` (`_writes-content.ts` 34KB, `_writes-social.ts` 31KB, …) — correctly non-routed, but domain logic belongs under `modules/`, not `api/`.
- Action: extract to services/workflows per CLAUDE.md; move Jarvis tool logic into a module.

### P2 — Storefront/console god-files with logic in the view
- `apps/storefront/src/lib/merchant-admin/api.ts` — 8116 lines / 212KB, 361 exported fns (auth is centralized via one `request<T>`, so it's organization not correctness). Split by domain.
- `apps/storefront/src/app/editor/[slug]/page.tsx` (3668) + `editor-canvas/[slug]/page.tsx` (2668) — NOT an abandoned experiment: editor iframes editor-canvas; both live. Still oversized.
- Dashboard detail pages 1.5k-2.3k lines: `dashboard/products/[id]/page.tsx` (2355), `promotions/[id]/page.tsx` (2089), `orders/[id]/page.tsx` (1840).
- Console: `apps/console/src/app/control/stores/page.tsx` (44KB), `control/partners/page.tsx` (42KB) — extract `useStores`/`usePartners` hooks + sub-panels.
- voice-agent: `apps/voice-agent/bot.py` — 2407 lines, one `BotSession` class (~1740 lines / 40 methods) mixing TTS/STT/LLM-tools/transport/recording/lifecycle. Split into collaborators.

### P2 — Thin input validation on the backend
Only ~75 of 493 route files use zod / `validateAndTransformBody`; ~234 cast `req.body` raw (`as Type` / `?? {}`).
- Action: add schema validation to merchant/admin write routes.

---

## MISSING INDEXES / SCALE

### P2 — tenant_id models without a tenant_id index
Most tenant models are indexed correctly (93/102). Candidates lacking a tenant_id index (verify composite coverage first): `apps/backend/src/modules/contact/models/contact-message.ts` (clearest — no `.indexes()` at all), `modules/cms/models/media.ts`, `modules/cms/models/media-folder.ts`, `modules/cms/models/section.ts`, `modules/cms/models/audit-log.ts`, `modules/theme/models/theme.ts`, `modules/marketing/models/platform-credential.ts`, `modules/platform/models/partner-commission.ts`, `modules/platform/models/support-ticket.ts`.
- Action: add `IDX_<table>_tenant_id` where the table is read tenant-scoped and non-trivial in volume (cms media/section are the hot ones).

### P2 — Other unbounded single-page scans
`apps/backend/src/lib/marketing-event-tenant.ts:62` (`take: 10000`), `jobs/_marketing-tenant-sweep.ts:44` (`take: 10000`), plus many `take: 1000` single reads in `api/merchant/*` and `api/store/*`. Fine now, silently truncates at 10k scale.

---

## SAFE GARBAGE TO DELETE

### P3 — Backup dirs & tarball committed to the tree (all from the single squashed init commit, untouched since — safe)
`/.backups/` (132KB), `/.b2d-backups-20260707-061913/` (140KB), `/snapshots-20260707/` (164KB), `apps/backup-cms-trustmodel-20260708-124541.tgz`.
- Action: `git rm -r` all four; history/VM copies remain.

### P3 — 615MB of Next.js build output tracked in git
`apps/storefront/.next-prev/` — 878 files of build output are tracked (deploy-script rollback dir). `.next-prev/` and `.next-build/` are not in `.gitignore`.
- Action: `git rm -r --cached apps/storefront/.next-prev`; add `.next-prev/` and `.next-build/` to `.gitignore`.

### P3 — 73 tracked macOS AppleDouble `._*` files (82 on disk)
e.g. `apps/backend/src/lib/._tenant-context.ts`, `apps/._backend`, and 50+ under `apps/backend/src/api/admin/cms/**`.
- Action: `find . -name '._*' -not -path '*/node_modules/*' -delete` then `git rm`; add `._*` to `.gitignore`. Pure metadata, never imported.

### P3 — Stray `.bak` files (untracked, `*.bak*` gitignored, but sitting in the tree)
`apps/voice-agent/bot.py.bak-piper-20260717080133` + `bot.py.bak-piperfix-20260717090829` (confirmed stale subsets of live bot.py), `apps/console/themes-page.tsx.bak`, `apps/console/src/lib/api/ai-usage.ts.bak-margin-*`, `apps/console/src/app/control/ai-usage/page.tsx.bak-margin-*`, `apps/console/src/components/sidebar.tsx.bak-aiusage-*`, `apps/merchant-app/android/app/build.gradle.kts.bak`, `apps/backend/src/api/merchant/jarvis/_voice.ts.bak-piper-*`.
- Action: delete all; superseded by their live siblings.

### P3 — Duplicate lockfile & doc sprawl
`apps/console/package-lock.json` (81KB) tracked inside a workspace that has a root lockfile. 49 tracked plan/spec `.md` (incl. BOTH `BRAND2DOOR-MASTER-PLAN.md` and `-V2.md`; `apps/storefront/JARVIS_OS_SPEC.md` + `JARVIS_UNIFIED_SPEC.md` inside the app package).
- Action: remove the console lockfile (or document why standalone); relocate specs/plans to a `/docs` or `/plans` dir.

### P3 — Documented dead model fields
`apps/backend/src/modules/marketing/models/chatbot.ts:39` (`@deprecated DEAD FIELD (A-6)`), `modules/marketing/models/agent.ts:26` (dead `"inbox"` kind).
- Action: drop columns via migration after confirming no reads.

---

## BUILD / DEPLOY FRAGILITY TO HARDEN

### P1 — Reproducibility depends on an external, un-declared node_modules
See the top P1: storefront correctness hinges on `NODE_PATH=/home/ratul/foreverfinds/node_modules`. A reinstall in `foreverfinds` (or a prune) can pull deps out from under a running brandtodoor. Declaring the deps (top P1) is the fix; treat the hoist as an optimization, not a requirement.

### P2 — Next build masks type & lint errors
`apps/storefront/next.config.js` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. Combined with the multi-thousand-line untyped-checked god-files, real type errors ship to runtime.
- Action: at least run `tsc --noEmit` + lint as a non-blocking CI gate so regressions are visible.

### Good — the historically-fragile pieces are already mitigated (keep)
`scripts/deploy-storefront.sh` builds into `.next-build` via `NEXT_DIST_DIR`, validates `required-server-files.json`, atomically swaps (`.next -> .next-prev`, `.next-build -> .next`), health-gates, rolls back, and holds a stale-aware lock — this correctly fixes the mid-build `.next` truncation outage and enforces one-build-at-a-time. Keep it; the "never rm .next" rule is now structurally unnecessary for deploys (still applies to manual work).

### P3 — Flutter build/release fragilities (documented; track)
`merchant-app/pubspec.yaml` pins `dependency_overrides: path_provider_android: 2.2.17` to dodge a native CMake break; `shopper-app/WHITE_LABEL.md` documents a `~/.pub-cache` CMake write-permission failure and that release builds default to the **debug keystore** (real signing needs `android/key.properties`).
- Action: track the debug-keystore default as a release blocker; document the pub-cache fix in the deploy runbook.

---

## COMMENTS / READABILITY (highest-value places to document — not noise)

- `scripts/deploy-storefront.sh` and `apps/backend/medusa-config.ts admin` block are exemplary "why" comments — use them as the model.
- Add short "why" headers where a non-obvious constraint lives and is currently undocumented: the cents-vs-units contract on each money formatter; why `NODE_PATH` points at foreverfinds (and that it is not a substitute for declaring deps); the `take:` caps in `marketing/ads/autopilot.ts` and the two gateway `tenantProductIds` (state the intended bound); the `_`-prefix routing-exclusion convention on `api/**/_*.ts`; the in-memory OTP durability limitation at its call sites.
- Do NOT add narration comments to the god-files — split them instead.
