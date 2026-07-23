# QA Findings — Authentication & Authorization Audit

Scope: brandtodoor / mAutomate shared multi-tenant backend (`apps/backend`),
storefront + merchant dashboard (`apps/storefront`), super-admin console
(`apps/console`), Flutter apps (`apps/merchant-app`, `apps/shopper-app`),
voice-agent. Personas: merchant, super-admin (operator), partner/affiliate,
storefront customer. READ-ONLY audit. Date: 2026-07-18.

Severity: P0 = exploitable now, high impact. P1 = serious, likely exploitable.
P2 = real weakness / hardening gap. P3 = low-risk / defense-in-depth / UX.

---

## Executive summary

No P0 or P1 authZ break was found. The historically dangerous surfaces —
editor tokens, the Jarvis money-write confirm gate, super-admin impersonation,
and per-merchant tenant scoping — are all correctly defended and the prior
editor-token tenant leak is fixed. The findings below are hardening gaps
(rate-limiting, an unauthenticated metrics endpoint, a money-touching S2S
secret, token-at-rest in localStorage) plus UX/availability gaps
(no password-reset delivery).

---

## P2 findings

### P2-1 — No rate-limiting or lockout on ANY authentication endpoint
Files: `src/api/middlewares.ts` (no auth-scoped limiter), `src/lib/rate-limit.ts`
(only wired into `src/api/marketing-chat/message|session` + `chat-tools.ts`),
`src/api/auth/merchant/mfa/verify/route.ts`.
Weakness: merchant/customer/admin login (`/auth/*/emailpass`), the MFA-verify
endpoint, and any reset flow have NO brute-force protection, no account
lockout, no per-IP throttle. A capable fixed-window limiter EXISTS but is only
applied to the public marketing-chat routes.
Attack: credential stuffing / password spraying against `/auth/merchant/emailpass`
and `/auth/customer/emailpass`; TOTP/backup-code brute force against
`/auth/merchant/mfa/verify` (6-digit TOTP = 1e6 space, backup codes finite) once
the first factor is known. No signal is raised and nothing slows the attacker.
Fix: apply `consumeRateLimit` (keyed on IP + identifier) as a middleware on
`/auth/*` POST and on `/auth/merchant/mfa/verify`; add exponential backoff /
temporary lockout after N failures; alert on bursts.

### P2-2 — `/metrics` is unauthenticated and exposes platform-wide business/financial data + triggers unbounded scans
File: `src/api/metrics/route.ts` (whole handler; `GET`).
Weakness: intentionally unauthenticated ("restrict at the edge"). It returns
`b2d_tenants_total`, tenant counts by status, and TOTAL credit balance /
reserved / granted / spent across ALL wallets, and it does so by loading
`listTenants`, `listCreditWallets`, `listCreditTransactions` each with
`take: 100000`.
Attack: (a) info disclosure — anyone who can reach the route learns customer
count, growth, and platform financial totals; (b) DoS amplification — each
unauthenticated GET triggers three ~100k-row scans, so repeated hits are a cheap
resource-exhaustion lever. Security rests entirely on edge/network ACLs being
correct; a single tunnel/edge misconfig exposes it.
Fix: require a scrape bearer token / mTLS / bind to localhost for Prometheus;
cap the query sizes and/or precompute counts; do not compute per-wallet sums on
an internet-reachable path.

### P2-3 — `/platform/internal/meter` uses a non-timing-safe secret compare and can mutate ANY tenant's credit wallet
File: `src/api/platform/internal/meter/route.ts`
(`if (!secret || req.headers["x-platform-meter-secret"] !== secret)`).
Weakness: (1) the secret is compared with `!==` (not timing-safe, unlike the
CMS/telephony gates which hash+`timingSafeEqual`); (2) authorization is a single
global shared secret with NO per-tenant binding — the caller passes `tenant_id`
in the body and can `reserve`/`commit`/`release` credits against ANY tenant's
wallet. This endpoint moves money (credit ledger).
Attack: any holder of `PLATFORM_METER_SECRET` (or one who guesses/leaks it) can
drain or inflate an arbitrary tenant's wallet by supplying that tenant_id.
Cross-tenant financial impact from one secret.
Fix: hash+`timingSafeEqual` the compare (match the other gates); scope the
credential per tenant or sign the request; log + alert on meter mutations.

### P2-4 — Privileged bearer JWTs stored in `localStorage` (super-admin console + merchant/partner dashboards)
Files: `apps/console/src/lib/auth.tsx` (`localStorage b2d_control_token`, lines ~28/51/61),
`apps/storefront/src/lib/auth.tsx`, `apps/storefront/src/lib/merchant-admin/auth.tsx`,
`apps/storefront/src/lib/partner/auth.tsx` (all `localStorage.setItem(STORAGE_KEY, token)`).
Weakness: tokens are readable by any JavaScript on the origin, so a single XSS
(or a malicious/compromised dependency) exfiltrates a live session. Most acute
for the **super-admin console**, whose token can list/suspend/impersonate every
tenant. Tokens are stateless JWTs — logout only deletes the local copy; there is
no server-side revocation, so a stolen token stays valid to expiry.
Attack: XSS on the console/dashboard origin -> steal token -> full platform or
full-store takeover until expiry.
Fix: move the session to an httpOnly + Secure + SameSite cookie (esp. for the
console); add short access-token TTL with refresh rotation and a revocation
list; strict CSP on the console origin.

### P2-5 — Control-plane `/admin/*` RBAC asymmetry: only `/admin/platform/*` is allowlist-gated
Files: `src/api/middlewares.ts` (`requirePlatformSuperAdmin` matches only
`/admin/platform/*`); ungated-beyond-`authenticate("user")` routes include
`/admin/payments/gateways`, `/admin/themes`, `/admin/domains`,
`/admin/marketing-setup/claim-owner`, `/admin/call-center-bootstrap/owner`,
`/admin/contact`, `/admin/custom`.
Weakness: those powerful operator routes are protected only by "is an
authenticated admin USER," while `/admin/platform/*` additionally requires
membership in `PLATFORM_SUPERADMIN_EMAILS`. Any admin user that is NOT on the
super-admin allowlist can still configure payment gateways, upload themes, and
manage domains platform-wide.
Attack: a lower-trust admin user (if any exist on the control-plane instance)
reaches high-impact operator tooling that the platform guard was meant to fence
off. Safe ONLY under the invariant "every admin user on this instance is a full
super-admin," which is not enforced in code.
Fix: either enforce the allowlist across the whole privileged `/admin/*`
control surface (not just `/admin/platform`), or introduce explicit admin-user
roles; document + enforce that admin-user creation is restricted to operators.

---

## P3 findings

### P3-1 — CMS admin guard fails OPEN to role "admin" on any role-resolution error
File: `src/api/middlewares.ts` `requireAuthenticatedAdmin` (`catch { role = "admin" }`).
Weakness: an authZ decision defaults to the MOST privileged role when role
lookup throws (e.g. table missing). Blast radius is limited to `actor_type
"user"` (merchants/partners cannot reach `/admin/cms/*`), so on the shared
backend this only affects operators — but a fail-open on an authZ path is a
latent risk if admin-user trust ever tiers.
Fix: fail closed (deny) on resolution error; keep an explicit, narrow
bootstrap/no-rows exemption instead of a broad catch-all to "admin".

### P3-2 — `/support/contact` is public, unbounded, no rate-limit/captcha
File: `src/api/support/contact/route.ts` (`POST`, creates a support ticket).
Weakness: any anonymous client can create tickets in a loop (max 5KB message).
Attack: ticket-table flooding / spam / noise DoS on the operator inbox.
Fix: per-IP rate-limit (reuse `consumeRateLimit`), captcha or proof-of-work.

### P3-3 — Signup endpoint enumerates registered merchant emails
File: `src/api/platform/signup/route.ts` (distinct `409 "an account with <email>
already exists"` vs slug-taken).
Weakness: user-enumeration — an attacker can probe which emails already have a
merchant account. Also the per-IP signup limiter (`recent` Map, 5/hr) is
in-process only (resets on restart, not shared across instances).
Fix: return a generic conflict message or a neutral "check your email" response;
back the signup limiter with the shared Redis limiter.

### P3-4 — Stateless JWTs with no server-side revocation
Files: `src/modules/platform/super-admin.ts` (impersonation `jwt.sign … 30m`),
`src/api/platform/signup/route.ts` (`jwt.sign … 30m`),
`src/api/auth/merchant/mfa/verify/route.ts` (`jwt.sign … 24h`).
Weakness: no denylist / rotation; a leaked token is valid until expiry and
logout cannot invalidate it. Standard JWT tradeoff, noted for completeness.
Fix: keep TTLs short (impersonation 30m is good); consider a revocation list for
the merchant 24h token and for impersonation.

### P3-5 (UX / availability) — No password-reset delivery is wired for any persona
Files: no `auth.password_reset` subscriber exists under `src/subscribers/`;
`src/api/middlewares.ts` only tenant-namespaces the reset REQUEST identifier.
Weakness: `POST /auth/*/emailpass/reset-password` emits the reset event and mints
a token, but nothing emails it, so merchants and shoppers cannot self-serve
recovery (operators must re-issue via
`/admin/platform/tenants/[id]/merchant` or `/partners/[id]/credentials`).
Latent security note: when this IS wired, the reset link host must be
tenant-correct and the token single-use + short-TTL + user-bound.
Fix: add a password-reset notification subscriber with a tenant-correct host and
a single-use expiring token; keep responses neutral to avoid enumeration.

---

## Flows verified SOLID (regression checks passed)

- **Editor-token tenant leak — FIXED.** `src/modules/cms/tenant-scope.ts`
  `requireWriteTenant` derives the write tenant from the SIGNED merchant
  identity (a spoofable publishable key may only AGREE, never override), or a
  secret-gated storefront-proxy assertion, or an operator admin user; fails
  closed otherwise. `src/api/cms/visual-publish/route.ts` additionally refuses
  to publish over a page owned by a different tenant.
- **Jarvis money-write confirm gate — exemplary.**
  `src/api/merchant/jarvis/_plan-token.ts` + `apply/route.ts`: HMAC-SHA256 with a
  DEDICATED `JARVIS_PLAN_SECRET` (fail-closed if <16 chars, never falls back to
  broad secrets), 2-minute TTL, tenant-bound (`plan.tid === ctx.tenant.id`),
  atomic single-use nonce claimed in `jarvis_audit` BEFORE execution, hard-tier
  typed confirm word, full audit trail, timing-safe signature compare.
- **Merchant per-tenant scoping — consistent + fail-closed.** Every sampled
  `/merchant/*` handler resolves `resolveMerchant(req)` (`_helpers.ts`:
  actor_type "merchant" + status "active" + tenant lookup) and filters DB
  queries by `ctx.tenant.id`. Cross-tenant ids 404 (`customers/[id]`,
  `ads/campaigns/[id]`, `blog/posts/[id]`).
- **Super-admin platform guard — fail-closed.** `requirePlatformSuperAdmin`
  requires membership in `PLATFORM_SUPERADMIN_EMAILS` (denies when unset, no
  fail-open). Impersonation (`super-admin.ts`) mints a 30-minute token for the
  target tenant's OWN merchant only, and is audited.
- **Per-store customer isolation.** `namespaceCustomerAuthIdentity` tenant-prefixes
  the emailpass identifier on customer login/register/reset (fail-closed on no
  tenant); `stampCustomerTenant` + `scopeCustomerMeToTenant` add defense in depth.
- **Persona separation.** `resolveMerchant`/`resolvePartner` require the exact
  actor_type AND a successful record lookup, so a token minted for the wrong
  persona (shared-email edge case) fails at resolve — a merchant token cannot act
  as a partner or vice versa, and neither can reach `/admin/*` (needs actor_type
  "user").
- **MFA gate.** `requireMerchantMfa` blocks all `/merchant/*` except
  `/merchant/mfa/*` for MFA-enabled merchants holding a stage-1 token.
- **Flutter token storage — correct.** `apps/merchant-app/lib/core/auth/secure_store.dart`
  and `apps/shopper-app/lib/features/auth/auth_store.dart` use
  `FlutterSecureStorage` (Android `encryptedSharedPreferences: true`); only the
  non-sensitive cart id is in plain `shared_preferences`.
- **Voice endpoints — tenant-scoped server-side.** `/merchant/jarvis/voice/start`
  and `/voice/pending` sit behind `authenticate("merchant")` + `resolveMerchant`;
  the tenant is stamped from the session, never client-supplied; voice writes
  flow through the same signed, tenant-bound plan-token confirm gate.
- **Webhook perimeters.** Stripe (`/webhooks/payment/*`) and Meta
  (`/marketing-webhooks/*`) preserve raw body for signature verification;
  telephony has a timing-safe shared-secret gate PLUS per-provider signature
  in-handler. Marketing email open/click/unsubscribe are signed-token gated.
- **No secrets in client bundles.** Grep of `apps/console/src` + `apps/storefront/src`
  found no embedded JWT/cookie/Stripe/CMS/Jarvis secrets (only a UI placeholder
  and an env-var label). `/tenant-config` returns only public data (publishable
  key, public chatbot embed key).

---

## User-friendliness improvements (without weakening security)

1. Wire password-reset email delivery for all personas (P3-5) — the single
   biggest self-service gap; use a tenant-correct host and single-use expiring
   tokens.
2. Keep auth error copy generic ("invalid email or password") to avoid
   enumeration, and soften signup's "account already exists" (P3-3) to a neutral
   response while keeping the UX helpful.
3. Password-manager compatibility is already good: the tenant prefix on the
   customer identifier is applied server-side in middleware, so the DISPLAYED
   email stays real and autofill works. Add explicit `autocomplete`
   (username/current-password/one-time-code) attributes on the login + MFA forms.
4. Surface clearer 429 messaging once auth rate-limiting (P2-1) lands, with a
   Retry-After, so legitimate users understand a temporary lockout.
5. Consider an httpOnly session cookie for the super-admin console (P2-4) — it
   removes the "paste token" friction AND reduces XSS blast radius.
