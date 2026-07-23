# Brand2Door — Master Fix & Production-Readiness Plan

> **Status:** Planning phase. No code changes until this plan is approved.  
> **Source of truth:** `/home/ratul/brandtodoor` (VM), not the local `medusa-develop` checkout. The local repo is upstream Medusa plus stale/incomplete `vm_mirror` overlays.

---

## 1. Executive Summary

The Brand2Door platform is a **multi-tenant Medusa v2 commerce control plane** with three satellite products that must integrate:

1. **E-commerce / merchant admin** (Medusa-based, pooled tenants).
2. **AI marketing automation** (journeys, campaigns, social, email, chatbot).
3. **AI call center** (voice agents, playbooks, campaigns, telephony).
4. **Domain lifecycle** (free subdomains + custom domain purchase/SSL).

After exploring the VM deployment and the three reference projects (Calldone, Marketing Automation, Manob.ai), the gaps fall into four buckets:

| Bucket | Severity | Examples |
|---|---|---|
| **Broken UI ↔ backend contracts** | High | Superadmin blog `content` vs `body`; merchant overview `toFixed` crash; visual editor redirect/CORS. |
| **Incomplete merchant admin** | High | Orders, settings, payments, MFA, credits are placeholders or missing flows. |
| **Missing integrations** | High | Marketing/call-center UIs are not wired to merchant admin; Twilio/provider setup missing; domain purchase not implemented. |
| **Multi-tenant safety gaps** | Critical | Marketing/call-center commerce gateways accept `tenantId` but do not filter Medusa queries by sales channel/store. |

This plan is organized into **8 phases**. Each phase ends with a validation checklist before the next phase starts.

---

## 2. Source-of-Truth & Repository Strategy

### 2.1 Current reality
- **VM `/home/ratul/brandtodoor/apps/backend`** — has `platform` module, `/merchant/*`, `/admin/platform/*`, marketing/call-center routes, and migrations.
- **VM `/home/ratul/brandtodoor/apps/storefront`** — has the merchant-admin Next.js app and visual editor.
- **VM `/home/ratul/console`** — has the superadmin (control-admin) SPA.
- **Local `/Users/.../medusa-develop`** — upstream Medusa monorepo with `vm_mirror`/`vm_backend` overlays that are **incomplete and not wired**.

### 2.2 Decision
All fixes, audits, and new features are implemented and tested on the **VM codebase**. The local checkout is used only for documentation, planning, and reference-project comparison.

### 2.3 First task (Phase 0)
- [ ] Create a clean Git snapshot/branch on the VM before any change.
- [ ] Confirm which files in `vm_mirror/` have already been copied into the VM storefront/backend.
- [ ] Delete or archive stale `vm_mirror` copies that are not source-of-truth to avoid confusion.

---

## 3. Gap Register

### 3.1 E-commerce / Merchant Admin
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 1 | Merchant **orders** page is a placeholder. | `src/app/merchant-admin/orders/page.tsx` shows empty-state only. | Core merchant cannot fulfill/cancel/refund. |
| 2 | Merchant **settings** page is a placeholder. | `src/app/merchant-admin/settings/page.tsx`. | Store name, payment, MFA, credits unreachable. |
| 3 | Product detail: compare-at price disabled, collection read-only, single variant only. | `products/[id]/page.tsx` + API. | Merchants cannot run sales or manage variants. |
| 4 | Missing Medusa catalog features: categories, collections, inventory locations, gift cards, promotions, price lists, sales channels. | Sidebar + API audit. | Far behind Shopify/Medusa baseline. |
| 5 | Visual editor UX incomplete; theme CSS loading was broken; redirect to 127.0.0.1 was leaking. | Fixed in latest patch; needs end-to-end validation. | WYSIWYG store builder is a core value prop. |
| 6 | Storefront `metadataBase` warning and OpenGraph images point to `localhost:8601`. | Build logs. | SEO/social previews broken in production. |

### 3.2 Superadmin / Control Plane
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 7 | **Blog edit content is empty** — console sends/expects `content`, backend stores `body`. | `apps/backend/src/api/admin/platform/blog/route.ts` vs console `blog.ts`. | Superadmin cannot edit blog posts. |
| 8 | Several `/admin/platform/*` screens may have similar field-name mismatches. | Needs systematic contract test. | Silently broken features across control panel. |
| 9 | Billing & metering is mocked. | `control/overview/page.tsx` comment. | No real revenue recognition. |
| 10 | Operator allowlist (`PLATFORM_SUPERADMIN_EMAILS`) is hard-coded to 2 emails; user’s email is not included. | `.env` + middleware. | Owner cannot access platform controls. |

### 3.3 Marketing Automation
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 11 | Merchant admin has no marketing section UI. | Sidebar only has overview, products, orders, customers, domains, design, settings. | Marketing product is invisible to merchants. |
| 12 | Admin marketing routes exist (`/admin/marketing/*`) but merchant-scoped marketing routes may be incomplete. | VM backend audit needed. | Merchants cannot create journeys/agents/campaigns. |
| 13 | Journey builder UI does not exist in any reference project either; only campaign lists exist. | Reference-project reports. | The "create journey" flow the user wants must be designed from scratch. |
| 14 | Marketing commerce gateway ignores `tenantId` on product/order/customer reads/writes. | `vm_backend/src/modules/marketing/gateway/medusa-adapter.ts` TODOs. | Cross-tenant data leak. |
| 15 | `runJourneySweep` falls back to `MARKETING_DEFAULT_TENANT` when async context is missing. | `journey/runner.ts`. | Background jobs may run on wrong tenant. |

### 3.4 Call Center
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 16 | Merchant admin has no call-center section UI. | Sidebar audit. | Call-center product is invisible. |
| 17 | No Twilio/provider credentials UI or backend provisioning. | Reference Calldone has `/telephony/twilio/*`; Brand2Door does not. | Cannot place/receive calls. |
| 18 | Call-center commerce gateway also ignores `tenantId`. | `vm_backend/src/modules/call-center/gateway/medusa-adapter.ts`. | Cross-tenant order/customer access. |
| 19 | Call-center migrations may be missing or out of sync. | Reference report: no migrations dir found in local overlay. | VM must be checked. |
| 20 | Agent creation/training/conversation UI not wired. | Calldone has full agent wizard; Brand2Door has none in merchant admin. | Users cannot create or talk to agents. |

### 3.5 Domains
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 21 | Merchants can only **connect** an existing domain; they cannot **search/buy** a domain. | `merchant-admin/domains/page.tsx` + backend `/merchant/domains`. | Revenue leak; friction for non-technical merchants. |
| 22 | No integration with Namecheap/ResellerClub/Cloudflare registrar on the VM. | Manob.ai has the service layer but it is mocked/broken. | Domain purchase is unimplemented. |
| 23 | Custom domain SSL/verification flow needs validation end-to-end. | DNS/SSL logic exists but not tested recently. | Stores on custom domains may 404. |

### 3.6 Security / Multi-tenancy (Critical)
| # | Gap | Evidence | Risk |
|---|---|---|---|
| 24 | Marketing/call-center gateways do not scope Medusa queries by tenant/sales channel. | TODO comments in gateway code. | **Cross-tenant data leak.** |
| 25 | Tenant context falls back to env/default when async context is missing. | `tenant-context.ts`. | Background jobs run on wrong tenant. |
| 26 | Merchant and control tokens stored in `localStorage`. | `auth.tsx` files. | XSS theft. |
| 27 | `_tenant_backend` cookie is trusted without allow-list. | `lib_merchant-admin/api.ts`. | Subdomain takeover / backend redirect attack. |
| 28 | Marketing email HMAC has hard-coded dev fallback secret. | `email/tokens.ts`. | Forged unsubscribe/click tracking. |
| 29 | No systematic cross-tenant leak tests run on deploy. | `platform-e2e-test.js` exists but not in CI. | Regressions go unnoticed. |

---

## 4. Phased Plan

> **Rule:** A phase is not considered complete until every item in its validation checklist passes. Agents are assigned per phase; each agent writes a validation report before hand-off.

---

### Phase 0 — Stabilize the Foundation (Week 1)
**Goal:** Stop the bleeding. Fix the crashes and contract mismatches the user already reported, and lock the source of truth.

#### Tasks
1. **Repository hygiene**
   - [ ] Snapshot VM codebase (`git branch`, `git commit`, or `tar` backup).
   - [ ] Reconcile `vm_mirror/` with VM: identify what was already copied, delete stale copies.
   - [ ] Document the VM directory structure in `DEPLOYMENT.md`.

2. **Fix reported UI/backend contract bugs**
   - [ ] Superadmin blog: align console `content` ↔ backend `body` field.
   - [ ] Merchant overview `toFixed` crash: guard all KPI formatters against null/undefined.
   - [ ] Visual editor: confirm CSS loads, cookie flow works, redirects stay on public domain.
   - [ ] Trial signup: already fixed (sample-product handle collision). Validate again.

3. **Environment / access**
   - [ ] Add the owner’s email (`easital@gmail.com` or whichever they use to log in) to `PLATFORM_SUPERADMIN_EMAILS` and restart backend.
   - [ ] Confirm `SIGNUP_ENABLED=true` and rate limits are acceptable.

4. **Baseline health dashboard**
   - [ ] Create a simple health page/script listing every service, its port, and its last known status.

#### Validation Checklist
- [ ] Superadmin can create, edit, and view blog posts with content preserved.
- [ ] Merchant overview loads without JS errors for a fresh tenant.
- [ ] Visual editor opens from merchant admin and renders styled canvas.
- [ ] Public trial signup creates a live store in < 10 seconds.
- [ ] Owner email can access `/control/*` screens.

---

### Phase 1 — Complete Merchant Admin Core (Weeks 2–3)
**Goal:** The merchant admin is functionally equivalent to a baseline Shopify/Medusa store admin for day-to-day operations.

#### Tasks
1. **Orders**
   - [ ] Build `/merchant-admin/orders` list (id, status, total, customer, date, filters, pagination).
   - [ ] Build `/merchant-admin/orders/[id]` detail with items, fulfillments, payments, timeline.
   - [ ] Wire fulfill, cancel, refund, capture-payment actions.
   - [ ] Add order export.

2. **Settings**
   - [ ] Store general settings (name, description, logo, favicon, contact email, phone).
   - [ ] Regions & currencies read-only view (managed by platform).
   - [ ] Payment providers (status/connect UI).
   - [ ] Merchant MFA setup/reset.
   - [ ] Credits balance + top-up CTA.

3. **Product catalog depth**
   - [ ] Categories page (list, create, edit, assign products).
   - [ ] Collections page.
   - [ ] Product variants UI (options, SKUs, prices, inventory per variant).
   - [ ] Enable compare-at price and collection assignment on product detail.
   - [ ] Inventory locations if enabled.

4. **Customers**
   - [ ] Customer list with search/filters.
   - [ ] Customer detail (profile, orders, address book, segment/tags).

#### Validation Checklist
- [ ] Merchant can receive, view, fulfill, and refund a real order end-to-end.
- [ ] Merchant can create a product with multiple variants and prices.
- [ ] Merchant can edit store settings and logo.
- [ ] No `toFixed`/null crashes in any KPI or formatter.

---

### Phase 2 — Multi-Tenant Hardening (Weeks 3–4, parallel with Phase 1 backend work)
**Goal:** Prove that tenant A can never see tenant B’s data.

#### Tasks
1. **Tenant resolution middleware**
   - [ ] Verify every `/merchant/*` route resolves tenant from JWT or `x-tenant-id` and wraps with `withTenant`.
   - [ ] Verify storefront middleware resolves tenant by Host and forwards tenant headers.

2. **Commerce gateway scoping**
   - [ ] Audit every function in `marketing/gateway/medusa-adapter.ts` and `call-center/gateway/medusa-adapter.ts`.
   - [ ] Add tenant → store/sales-channel filters to all product/order/customer/cart queries.
   - [ ] Add ownership checks before every write (metadata update, cancel, refund, etc.).

3. **Background job scoping**
   - [ ] Remove fallbacks to `MARKETING_DEFAULT_TENANT` / `CALL_CENTER_DEFAULT_TENANT`.
   - [ ] Ensure every job carries `tenant_id` and fails closed if missing.

4. **Security hardening**
   - [ ] Remove hard-coded dev fallback secrets (email HMAC, etc.).
   - [ ] Validate `_tenant_backend` cookie against an allow-list of the tenant’s own backend URL.
   - [ ] Add rate limiting to public signup and login endpoints.

5. **Automated isolation tests**
   - [ ] Make `platform-e2e-test.js` part of the deploy pipeline.
   - [ ] Add tests: tenant A product/order should not be visible to tenant B via merchant/storefront/marketing/call-center APIs.

#### Validation Checklist
- [ ] Cross-tenant read test fails (returns 404/empty) for products, orders, customers, marketing contacts, call logs.
- [ ] Cross-tenant write test fails for order metadata update, cancel, refund.
- [ ] Background job test confirms jobs run only in their originating tenant.
- [ ] `platform-e2e-test.js` passes cleanly.

---

### Phase 3 — Marketing Automation in Merchant Admin (Weeks 4–6)
**Goal:** Merchants can create journeys, campaigns, chatbots, and social/email content from the same dashboard.

#### Tasks
1. **Navigation & shell**
   - [ ] Add "Marketing" section to merchant sidebar.
   - [ ] Sub-items: Dashboard, Journeys, Campaigns, Chatbots, Social, Email, Segments, Content, Analytics.

2. **Journey builder (new UI)**
   - [ ] Design a visual or form-based journey editor: trigger → wait/condition → action nodes.
   - [ ] Triggers: cart abandoned, order placed, customer created, product viewed.
   - [ ] Actions: send email, send SMS, add to segment, create task, chatbot reply, delay.
   - [ ] Persist to `marketing_journey` and `marketing_journey_enrollment`.
   - [ ] Wire `runJourneySweep` to execute on schedule.

3. **Campaigns**
   - [ ] List/create campaigns (email/social/SMS).
   - [ ] Audience selection from segments.
   - [ ] Schedule or send now.

4. **Chatbot**
   - [ ] Create chatbot, set channels (website widget, Messenger, WhatsApp, Telegram if providers available).
   - [ ] Training: text, PDF, URL ingestion.
   - [ ] Live chat / conversation inbox.

5. **Social / Email**
   - [ ] Connect social accounts (OAuth where available).
   - [ ] Create posts/emails with AI assist.
   - [ ] Approval workflow + content calendar.

#### Validation Checklist
- [ ] Merchant can create a journey that sends an email when a cart is abandoned.
- [ ] Merchant can create and train a chatbot that replies in the inbox.
- [ ] Merchant can schedule a social post or email campaign.
- [ ] All marketing data is scoped to the merchant’s tenant.

---

### Phase 4 — AI Call Center in Merchant Admin (Weeks 6–8)
**Goal:** Merchants can create voice agents, connect phone numbers, run campaigns, and review calls.

#### Tasks
1. **Navigation & shell**
   - [ ] Add "Call Center" section to merchant sidebar.
   - [ ] Sub-items: Agents, Phone Numbers, Campaigns, Playbooks, Calls/Logs, Analytics.

2. **Agent creation & training**
   - [ ] Agent wizard: name, voice, language, greeting, instructions.
   - [ ] Knowledge base: upload documents/URLs.
   - [ ] Tools: order lookup, appointment booking, transfer to human.

3. **Telephony setup**
   - [ ] Provider credentials UI (Twilio, Telnyx, Vonage).
   - [ ] Phone number purchase/connection UI.
   - [ ] Inbound/outbound webhook routing.

4. **Playbooks & campaigns**
   - [ ] Visual or rule-based playbook editor (greeting → intent → action).
   - [ ] Outbound campaign builder with contact list + schedule.

5. **Call logs & analytics**
   - [ ] Call list with recordings, transcripts, disposition.
   - [ ] KPI dashboard: calls, duration, cost, conversion.

#### Validation Checklist
- [ ] Merchant can create a voice agent with instructions and knowledge base.
- [ ] Merchant can connect a Twilio phone number (or test number in sandbox).
- [ ] Inbound test call routes through the agent and logs correctly.
- [ ] Outbound campaign can dial a contact list and record outcomes.

---

### Phase 5 — Domain Purchase & Lifecycle (Weeks 8–9)
**Goal:** Merchants can search, buy, and auto-configure custom domains without leaving Brand2Door.

#### Tasks
1. **Domain search**
   - [ ] Integrate Namecheap/ResellerClub domain search API.
   - [ ] Show availability, price, suggestions.

2. **Cart & checkout**
   - [ ] Add domain to cart.
   - [ ] Checkout with account info, billing address, payment (Stripe).

3. **Provisioning**
   - [ ] Purchase domain via registrar API on payment success.
   - [ ] Auto-create Cloudflare hostname + SSL.
   - [ ] Update `tenant_domain` table with verification/SSL status.

4. **Merchant UI**
   - [ ] Replace "connect domain" with "buy domain" + "connect existing domain" tabs.
   - [ ] Show domain status, renewal date, DNS records.

#### Validation Checklist
- [ ] Merchant can search and buy a real domain end-to-end (use sandbox registrar for testing).
- [ ] Purchased domain resolves to the store with SSL active.
- [ ] Existing domain connection still works.

---

### Phase 6 — Superadmin Control Plane Completion (Weeks 9–10)
**Goal:** The operator console can fully manage the platform.

#### Tasks
1. **Contract audit**
   - [ ] For every `/control/*` page, verify field names and response shapes match `/admin/platform/*` routes.
   - [ ] Fix all mismatches (blog was only the first).

2. **Real billing & metering**
   - [ ] Wire Stripe to packages/plans.
   - [ ] Implement usage metering per tenant.
   - [ ] Invoice generation and dunning.

3. **Platform operations**
   - [ ] Tenant suspension/resume with data retention policy.
   - [ ] Credit grants and usage reports.
   - [ ] Theme/package/entitlement management.
   - [ ] Audit log viewer.

4. **Governance**
   - [ ] Operator role management (not just a single allowlist).
   - [ ] Support ticket workflow.

#### Validation Checklist
- [ ] Operator can provision, suspend, credit, and delete a tenant.
- [ ] Billing dashboard shows real revenue, not mocked data.
- [ ] All `/control/*` pages load and mutate data correctly.

---

### Phase 7 — Production Readiness & Hardening (Weeks 11–12)
**Goal:** The platform is deployable, observable, and secure enough for 10k tenants.

#### Tasks
1. **Performance**
   - [ ] Database query audit: add missing indexes, N+1 fixes.
   - [ ] Redis caching strategy for tenant config, regions, CMS pages.
   - [ ] CDN cache rules for storefront static assets.

2. **Observability**
   - [ ] Structured logging with tenant_id correlation.
   - [ ] Error tracking (Sentry or equivalent).
   - [ ] Metrics: signup conversion, provisioning success rate, call/min, email/min.

3. **Security audit**
   - [ ] Penetration-test checklist: XSS, CSRF, SQL injection, IDOR, SSRF.
   - [ ] Secret rotation: Twilio, Stripe, Cloudflare, registrar APIs.
   - [ ] Move merchant/control tokens to `httpOnly` cookies with refresh rotation.

4. **Disaster recovery**
   - [ ] Automated DB backups tested.
   - [ ] Tenant export/import procedure documented.
   - [ ] Rollback plan for deployments.

5. **Documentation**
   - [ ] Operator runbook.
   - [ ] Merchant help center.
   - [ ] API documentation for partners.

#### Validation Checklist
- [ ] Load test: 100 concurrent signups, <5% failure.
- [ ] Security scan: no high/critical findings.
- [ ] Backup restore tested on a staging clone.
- [ ] All monitoring dashboards show live data.

---

## 5. Agent Allocation

| Phase | Agents | Focus |
|---|---|---|
| 0 | 2 | Backend contract fixes + repository hygiene; frontend crash fixes. |
| 1 | 3 | Orders, settings, catalog depth, customers. |
| 2 | 2 | Tenant middleware + gateway scoping + security. |
| 3 | 3 | Marketing UI + journey builder + chatbot. |
| 4 | 3 | Call-center UI + telephony + agent builder. |
| 5 | 2 | Domain search/purchase + Cloudflare/SSL automation. |
| 6 | 2 | Control-plane contract audit + billing. |
| 7 | 2 | Performance + observability + security hardening. |

**Total: ~19 agent-missions across 12 weeks.** Some can run in parallel.

---

## 6. Validation Methodology

Every phase must produce:

1. **Test tenant script** — automated Cypress/Playwright or `curl` script that exercises the phase’s flows.
2. **Cross-tenant leak test** — same script run for two tenants side-by-side, asserting isolation.
3. **Code-review checklist** — no `TODO(tenancy)` left, no `as any` on security paths, no dev fallback secrets.
4. **Sign-off** — a human (or the parent agent) reviews the validation report before proceeding.

---

## 7. Immediate Next Steps (Waiting for Approval)

1. Approve this plan or request changes.
2. I will then execute **Phase 0** first:
   - Snapshot the VM.
   - Fix the superadmin blog `content`/`body` mismatch.
   - Fix any other reported contract crashes.
   - Add the owner email to the superadmin allowlist.
   - Run the Phase 0 validation checklist.

Only after Phase 0 is green do we move to Phase 1.

---

## 8. Notes from Reference Projects

- **Calldone** has the most complete voice-agent pattern: agent wizard, knowledge base, tools, telephony providers, call logs, CRM. We should reuse its UX and data model concepts.
- **mAutomation (Wasp)** has the most complete marketing-automation pattern: brand voice, social/SEO agents, post hub, content calendar, central inbox. We should reuse its flow concepts.
- **Manob.ai** has domain search/cart/checkout service-layer structure, but the UI is mocked and broken. We should reuse the service contracts and registrar integrations, then build a working UI.

None of these projects have Brand2Door integration; all three integrations must be built fresh in the Brand2Door VM codebase.
