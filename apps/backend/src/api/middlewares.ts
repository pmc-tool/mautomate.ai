import crypto from "crypto"
import {
  authenticate,
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import multer from "multer"
import { Modules } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../modules/cms"
import { PLATFORM_MODULE } from "../modules/platform"
import { withTenant, getCurrentTenantId } from "../lib/tenant-context"
import { cmsTenantId } from "../modules/cms/tenant-scope"
import type CmsModuleService from "../modules/cms/service"
import {
  canCmsAccess,
  getRoleForUser,
  isWriteMethod,
  type CmsRole,
} from "../modules/cms/role-helper"
import {
  canCallCenterAccess,
  getCallAgentRole,
  CALL_CENTER_DEFAULT_TENANT,
} from "../modules/call-center/role-helper"
import {
  canMarketingAccess,
  getMarketingRole,
  MARKETING_DEFAULT_TENANT,
} from "../modules/marketing/role-helper"

/**
 * In-memory multipart parser for CMS media uploads. Mirrors the built-in
 * /admin/uploads middleware (multer.memoryStorage) so file buffers are handed
 * straight to uploadFilesWorkflow. 10MB hard cap (mime allowlist enforced in
 * the route handler). Field name: `files`.
 */
const cmsMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

/**
 * CMS RBAC guard — runs AFTER the global `/admin` `authenticate` middleware.
 *
 * Two layers (phase-0-architecture.md §8):
 *
 *   1. Authn: require a real admin USER (actor_type "user" + actor_id). Anything
 *      else (no auth context, api-key, etc.) → 403. Unchanged from Phase 1.
 *
 *   2. Authz (Phase 9): resolve the user's CMS role via `getRoleForUser` and
 *      enforce the (role × path × method) matrix from `canCmsAccess`:
 *        - admin  → everything
 *        - editor → reads (except roles area) + content writes (pages/sections/
 *                   blog/media); NOT settings writes, NOT role management
 *        - viewer → GET only (403 on every write)
 *
 * FAIL-SAFE: `getRoleForUser` returns "admin" whenever there is no explicit
 * cms_user_role row — and this guard additionally falls back to "admin" if role
 * resolution throws for any reason — so an authenticated admin user is NEVER
 * locked out before roles are assigned (only an explicit editor/viewer row
 * downgrades). The matcher is scoped to `/admin/cms/*` only.
 *
 * `req.cms_actor.role` is attached for downstream handlers/audit.
 */
async function requireAuthenticatedAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as any).auth_context ?? {}
  const actorId: string | undefined = auth.actor_id
  const actorType: string | undefined = auth.actor_type

  if (!actorId || actorType !== "user") {
    res.status(403).json({
      type: "not_allowed",
      message: "CMS access denied. An authenticated admin user is required.",
    })
    return
  }

  // Resolve the effective CMS role. FAIL OPEN to "admin" on any error so a
  // resolution failure (e.g. table not yet migrated) never locks out the admin.
  let role: CmsRole = "admin"
  try {
    const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
    role = await getRoleForUser(service, actorId)
  } catch {
    role = "admin"
  }

  // Enforce the role × path × method matrix. Use a path that always contains
  // the full `/admin/cms/...` prefix: prefer req.path, but fall back to the
  // originalUrl pathname if a mount ever makes req.path relative.
  let path = req.path || ""
  if (!path.startsWith("/admin/cms")) {
    const original = ((req as any).originalUrl ?? path) as string
    path = original.split("?")[0]
  }

  const isWrite = isWriteMethod(req.method)
  if (!canCmsAccess(role, path, isWrite)) {
    res.status(403).json({
      type: "not_allowed",
      message: `CMS access denied. Your role "${role}" is not permitted to ${req.method} ${path}.`,
    })
    return
  }

  // Expose the resolved actor (incl. role) for downstream audit logging.
  ;(req as any).cms_actor = {
    user_id: actorId,
    actor_type: actorType,
    role,
    email: auth.app_metadata?.email ?? null,
  }

  next()
}

/**
 * Timing-safe secret comparison. Mirrors the `x-cms-secret` check used by the
 * visual-editor media/visual-publish bridges: hash both sides to a fixed-length
 * digest before `timingSafeEqual` so lengths never leak and the compare is
 * constant-time.
 */
function callCenterSafeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

/**
 * Call-center RBAC guard — runs AFTER the global `/admin` `authenticate`
 * middleware, scoped to `/admin/call-center/*`.
 *
 * FAIL-CLOSED (the opposite of the CMS guard): a request only proceeds when the
 * user holds an explicit live `call_center_agent_role` row whose role is
 * permitted for this (path, method). Anything else — no auth context, non-user
 * actor, no role row, resolution error, or a role that lacks the permission —
 * gets 403. The `CALL_CENTER_ENABLED` flag does NOT relax this: the routes
 * exist regardless and must stay protected.
 *
 * `req.call_center_actor` is attached for downstream handlers/audit.
 */
async function requireCallCenterAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as any).auth_context ?? {}
  const actorId: string | undefined = auth.actor_id
  const actorType: string | undefined = auth.actor_type

  // Authn: require a real admin USER. Anything else → 401.
  if (!actorId || actorType !== "user") {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const tenantId = CALL_CENTER_DEFAULT_TENANT

  // Resolve the effective call-center role. FAIL CLOSED to `null` on any error.
  let role: Awaited<ReturnType<typeof getCallAgentRole>> = null
  try {
    role = await getCallAgentRole(req.scope, actorId, tenantId)
  } catch {
    role = null
  }

  // Normalize the path to always carry the full `/admin/call-center/...` prefix.
  let path = req.path || ""
  if (!path.startsWith("/admin/call-center")) {
    const original = ((req as any).originalUrl ?? path) as string
    path = original.split("?")[0]
  }

  // Authz: fail closed if the role×path×method matrix denies the request.
  if (!canCallCenterAccess(role, path, req.method)) {
    res.status(403).json({ message: "Forbidden" })
    return
  }

  ;(req as any).call_center_actor = {
    user_id: actorId,
    role,
    tenant_id: tenantId,
  }

  next()
}

/**
 * Telephony webhook coarse gate — scoped to `/telephony/*`. Verifies a shared
 * secret header (`x-telephony-secret === TELEPHONY_WEBHOOK_SECRET`) with a
 * timing-safe compare. This is the outer perimeter; per-provider (e.g. Twilio)
 * signature verification still happens in-handler. 401 on any mismatch or when
 * the secret is unset. Not affected by `CALL_CENTER_ENABLED`.
 */
function requireTelephonySecret(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const provided = req.headers["x-telephony-secret"]
  const expected = process.env.TELEPHONY_WEBHOOK_SECRET

  if (
    !expected ||
    typeof provided !== "string" ||
    !callCenterSafeEqual(provided, expected)
  ) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  next()
}

/**
 * Marketing RBAC guard — runs AFTER the global `/admin` `authenticate`
 * middleware, scoped to `/admin/marketing/*`.
 *
 * FAIL-CLOSED (like the call-center guard): a request only proceeds when the
 * user holds an explicit live `marketing_agent_role` row whose role is
 * permitted for this (path, method). Anything else — no auth context, non-user
 * actor, no role row, resolution error, or a role that lacks the permission —
 * gets 401 (no user) / 403 (denied).
 *
 * `req.marketing_actor` is attached for downstream handlers/audit.
 */
async function requireMarketingAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as any).auth_context ?? {}
  const actorId: string | undefined = auth.actor_id
  const actorType: string | undefined = auth.actor_type

  // Authn: require a real admin USER. Anything else → 401.
  if (!actorId || actorType !== "user") {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const tenantId = MARKETING_DEFAULT_TENANT

  // Resolve the effective marketing role. FAIL CLOSED to `null` on any error.
  let role: Awaited<ReturnType<typeof getMarketingRole>> = null
  try {
    role = await getMarketingRole(req.scope, actorId, tenantId)
  } catch {
    role = null
  }

  // Normalize the path to always carry the full `/admin/marketing/...` prefix.
  let path = req.path || ""
  if (!path.startsWith("/admin/marketing")) {
    const original = ((req as any).originalUrl ?? path) as string
    path = original.split("?")[0]
  }

  // Authz: fail closed if the role×path×method matrix denies the request.
  if (!canMarketingAccess(role, path, req.method)) {
    res.status(403).json({ message: "Forbidden" })
    return
  }

  ;(req as any).marketing_actor = {
    user_id: actorId,
    role,
    tenant_id: tenantId,
  }

  next()
}

/**
 * Platform (super-admin) guard — the control-plane routes /admin/platform/* let
 * an operator list ALL tenants, suspend, impersonate, and read platform metrics.
 * This is the most privileged surface in the product, so it is FAIL-CLOSED to an
 * explicit operator allowlist (`PLATFORM_SUPERADMIN_EMAILS`, comma-separated).
 *
 * If the allowlist is unset, access is DENIED — a tenant store's admins (e.g.
 * Forever Finds) therefore cannot reach the platform controls, and only the
 * control-plane instance (which sets the env) exposes them. There is no
 * fail-open fallback here (unlike the CMS guard): cross-tenant power must never
 * default to "any admin".
 */
async function requirePlatformSuperAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const actorId = (req as any).auth_context?.actor_id as string | undefined
  if (!actorId) {
    res.status(401).json({ message: "Authentication required." })
    return
  }
  const allow = (process.env.PLATFORM_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!allow.length) {
    res
      .status(403)
      .json({ message: "Platform administration is not enabled on this instance." })
    return
  }
  let email = ""
  try {
    const userModule: any = req.scope.resolve(Modules.USER)
    const user = await userModule.retrieveUser(actorId)
    email = (user?.email ?? "").toLowerCase()
  } catch {
    res.status(403).json({ message: "Forbidden." })
    return
  }
  if (!email || !allow.includes(email)) {
    res
      .status(403)
      .json({ message: "Forbidden — platform super-admin access only." })
    return
  }
  ;(req as any).platform_actor = { user_id: actorId, email }
  next()
}


/**
 * Merchant MFA gate — runs AFTER authenticate("merchant").
 *
 * If the merchant has enabled MFA, the bearer token must carry
 * `mfa_verified: true` (set by POST /merchant/mfa/verify after the user
 * supplies a TOTP/recovery code). Otherwise the login token from
 * /auth/merchant/emailpass is rejected with 403 + mfa_required.
 *
 * Routes under /merchant/mfa/* are exempt so the user can call the verify
 * endpoint with a non-MFA token.
 */

/**
 * Request-scoped tenant context — runs FIRST on every route.
 *
 * In the shared backend one Node process serves many tenants. Payment
 * providers, encrypted config, and other tenant-scoped services read the
 * current tenant from AsyncLocalStorage. This middleware resolves the tenant
 * from merchant auth, the storefront's forwarded tenant headers, or the
 * publishable API key, and wraps the rest of the request lifecycle in that
 * context.
 */
async function setTenantContext(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as any).auth_context ?? {}
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  let tenantId: string | undefined

  // 1. Merchant auth → merchant.tenant_id
  if (auth.actor_type === "merchant" && auth.actor_id) {
    const merchant = await svc.retrieveMerchant(auth.actor_id).catch(() => null)
    tenantId = merchant?.tenant_id
  }

  // 2. Storefront forwarded headers
  if (!tenantId) {
    const headerTenant = req.headers["x-tenant-id"] as string | undefined
    if (headerTenant) tenantId = headerTenant
  }

  // 3. Publishable API key → tenant
  if (!tenantId) {
    const pak =
      (req.headers["x-publishable-api-key"] as string | undefined) ||
      (req.query["publishable_api_key"] as string | undefined) ||
      ""
    if (pak) {
      const [tenant] = await svc.listTenants(
        { publishable_key: pak },
        { take: 1 }
      ).catch(() => [])
      tenantId = tenant?.id
    }
  }

  if (tenantId) {
    return withTenant(tenantId, () => next())
  }
  // Fail-closed: when NO tenant resolves we proceed with NO tenant context —
  // never a shared "default". Un-tenanted public reads / inbound webhooks /
  // marketing-widget session channels keep working; tenant-scoped services then
  // see `undefined` and must themselves refuse WRITES (see resolveTenantId
  // allowDefault + the CMS requireWriteTenant helper).
  return next()
}

async function requireMerchantMfa(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as any).auth_context ?? {}
  if (auth.actor_type !== "merchant" || !auth.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  // Allow MFA challenge endpoints with a non-verified token.
  let path = req.path || ""
  if (!path.startsWith("/merchant/mfa")) {
    const original = ((req as any).originalUrl ?? path) as string
    path = original.split("?")[0]
  }
  if (path.startsWith("/merchant/mfa")) {
    return next()
  }

  // Already MFA-verified → proceed.
  if (auth.mfa_verified === true) return next()

  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const merchant = await svc.retrieveMerchant(auth.actor_id).catch(() => null)
  if (!merchant || merchant.status !== "active") {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  if (!merchant.mfa_enabled) return next()

  res.status(403).json({
    type: "mfa_required",
    message: "Multi-factor authentication required. Complete /merchant/mfa/verify.",
  })
}

/**
 * Per-store customer isolation (Shopify parity) — AUTH LAYER.
 *
 * Medusa's emailpass provider keys `provider_identity.entity_id` on the raw
 * email GLOBALLY, so in the pooled backend one email = one customer account
 * across every tenant: a shopper who registers on store A cannot register the
 * same email on store B, and logging into store B authenticates store A's
 * account/password. Shopify isolates customers per store.
 *
 * Fix: namespace ONLY the auth identifier the emailpass provider consumes —
 * `<tenant_id>:<email>` — for the CUSTOMER emailpass register / login /
 * reset-password routes. The provider then stores/looks up a per-tenant
 * entity_id, so the SAME real email yields a SEPARATE auth identity (and thus a
 * separate customer) per store, and store A's credentials never authenticate on
 * store B. The DISPLAYED email is untouched: `POST /store/customers` (not
 * matched here) still receives the REAL email, so `customer.email` and order
 * emails stay real.
 *
 * Scope is deliberately narrow. The matchers below cover ONLY
 * `/auth/customer/emailpass` (login), `/auth/customer/emailpass/register`, and
 * `/auth/customer/emailpass/reset-password`. The admin (`/auth/user/*`) and
 * merchant (`/auth/merchant/*`) flows and the logged-in password-change route
 * (`/auth/customer/emailpass/update`, which keys on the token's actor_id, not
 * the email) are NOT touched — this change cannot affect any non-customer login.
 *
 * FAIL-CLOSED: the tenant is read from the request-scoped context established by
 * `setTenantContext` (publishable key / x-tenant-id). If no tenant resolves we
 * REJECT — an un-tenanted customer auth request must never fall back to the
 * global (shared) identifier.
 */
async function namespaceCustomerAuthIdentity(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.status(400).json({
      type: "invalid_data",
      message:
        "A store context (publishable API key) is required to register or sign in.",
    })
    return
  }

  const prefix = `${tenantId}:`
  const body = (req.body ?? {}) as Record<string, unknown>

  // register + login carry the email in `email`; reset-password carries it in
  // `identifier`. Guard against double-prefixing so a retry is idempotent.
  for (const field of ["email", "identifier"] as const) {
    const value = body[field]
    if (typeof value === "string" && value.length > 0 && !value.startsWith(prefix)) {
      body[field] = `${prefix}${value}`
    }
  }

  next()
}

/**
 * Per-store customer isolation (Shopify parity) — CUSTOMER WRITE.
 *
 * Companion to `namespaceCustomerAuthIdentity`: stamps the resolved tenant onto
 * the customer record created by `POST /store/customers` (the storefront's
 * account-creation call) as `metadata.tenant_id`, so the customer is durably
 * attributable to its store for downstream lookups/filtering (defence-in-depth
 * on top of the tenant-namespaced auth identity, which is already authoritative
 * for login isolation and `/store/customers/me`).
 *
 * FAIL-CLOSED: a customer must never be created without a tenant — if none
 * resolves we REJECT. The stamp is written to both `req.body` and (if already
 * built) `req.validatedBody` so it survives regardless of whether this runs
 * before or after the core body validator, and it MERGES with any client
 * metadata rather than clobbering it.
 */
async function stampCustomerTenant(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.status(400).json({
      type: "invalid_data",
      message: "A store context is required to create a customer account.",
    })
    return
  }

  const inject = (target: Record<string, unknown> | undefined) => {
    if (!target) return
    const existing = (target.metadata ?? {}) as Record<string, unknown>
    target.metadata = { ...existing, tenant_id: tenantId }
  }

  inject(req.body as Record<string, unknown> | undefined)
  inject((req as any).validatedBody as Record<string, unknown> | undefined)

  next()
}

/**
 * Per-store customer isolation (Shopify parity) — /store/customers/me SCOPE.
 *
 * Defence-in-depth on top of the tenant-namespaced auth identity (which is the
 * authoritative isolation: a login token is minted from a `<tenant>:<email>`
 * identity, so it already resolves the right per-store customer). This guard
 * additionally refuses a customer token that is replayed against a DIFFERENT
 * store: if the authenticated customer carries an explicit `metadata.tenant_id`
 * that does not match the request tenant, respond 401.
 *
 * FAIL-SAFE (deliberately NOT fail-closed here): when the request tenant is
 * unknown, there is no authenticated customer, the customer has no `tenant_id`
 * yet (legacy / pre-migration / the entangled demo account), or resolution
 * throws — we ALLOW and let the core handler proceed. Only an EXPLICIT tenant
 * mismatch is rejected, so this can never lock out an existing shopper; the
 * auth-layer namespacing remains the primary guarantee.
 */
async function scopeCustomerMeToTenant(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const tenantId = await cmsTenantId(req)
  const actorId = (req as any).auth_context?.actor_id as string | undefined
  if (!tenantId || !actorId) return next()

  try {
    const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
    const customer = await customerModule
      .retrieveCustomer(actorId)
      .catch(() => null)
    const customerTenant = customer?.metadata?.tenant_id as string | undefined
    if (customerTenant && customerTenant !== tenantId) {
      res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
      return
    }
  } catch {
    // Never lock a shopper out on a resolution error.
  }

  next()
}

export default defineMiddlewares({
  routes: [
    {
      // Global tenant context resolver — must run before any tenant-scoped service.
      matcher: "/(.*)",
      middlewares: [setTenantContext],
    },
    {
      // Per-store customer isolation: namespace the emailpass auth identifier
      // with the request tenant on the customer login / register / reset-password
      // routes. Fail-closed when no tenant resolves. See
      // namespaceCustomerAuthIdentity for the full rationale.
      matcher: "/auth/customer/emailpass",
      method: ["POST"],
      middlewares: [namespaceCustomerAuthIdentity],
    },
    {
      matcher: "/auth/customer/emailpass/register",
      method: ["POST"],
      middlewares: [namespaceCustomerAuthIdentity],
    },
    {
      matcher: "/auth/customer/emailpass/reset-password",
      method: ["POST"],
      middlewares: [namespaceCustomerAuthIdentity],
    },
    {
      // Per-store customer isolation: stamp the tenant onto the created customer.
      matcher: "/store/customers",
      method: ["POST"],
      middlewares: [stampCustomerTenant],
    },
    {
      // Per-store customer isolation: refuse a customer token replayed against a
      // different store (fail-safe — see scopeCustomerMeToTenant).
      matcher: "/store/customers/me*",
      middlewares: [scopeCustomerMeToTenant],
    },
    {
      // CORS preflight for the merchant SPA. OPTIONS must answer before auth,
      // otherwise the browser blocks /merchant/* calls after login.
      matcher: "/merchant/*",
      method: ["OPTIONS"],
      middlewares: [
        (req, res, next) => {
          const origin = req.headers.origin || ""
          const allowed = (process.env.AUTH_CORS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          if (allowed.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin)
            res.setHeader("Access-Control-Allow-Credentials", "true")
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
            res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-publishable-api-key")
            res.setHeader("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
          }
          res.status(204).end()
        },
      ],
    },
    {
      // Attach CORS headers to every /merchant/* response so that auth errors
      // (401/403) are readable by the SPA instead of being masked as CORS failures.
      matcher: "/merchant/*",
      middlewares: [
        (req, res, next) => {
          const origin = req.headers.origin || ""
          const allowed = (process.env.AUTH_CORS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          if (allowed.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin)
            res.setHeader("Access-Control-Allow-Credentials", "true")
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
            res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-publishable-api-key")
            res.setHeader("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
          }
          next()
        },
      ],
    },
    {
      // Merchant store admin — authenticate the "merchant" actor (bearer/session).
      // Every /merchant/* handler additionally scopes to the merchant's tenant.
      matcher: "/merchant/*",
      method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      middlewares: [authenticate("merchant", ["bearer", "session"]), requireMerchantMfa],
    },
    {
      // Fail-closed super-admin guard for the control plane (all methods).
      matcher: "/admin/platform/*",
      middlewares: [requirePlatformSuperAdmin],
    },
    {
      matcher: "/admin/cms/*",
      middlewares: [requireAuthenticatedAdmin],
    },
    {
      // Parse multipart bodies for the media upload route only.
      method: ["POST"],
      matcher: "/admin/cms/media",
      middlewares: [cmsMediaUpload.array("files")],
    },
    {
      // Parse multipart bodies for merchant product image uploads.
      method: ["POST"],
      matcher: "/merchant/products/:id/media",
      middlewares: [cmsMediaUpload.single("image")],
    },
    {
      // Parse multipart bodies for merchant marketing media uploads.
      method: ["POST"],
      matcher: "/merchant/marketing/media",
      middlewares: [cmsMediaUpload.single("file")],
    },

    {
      // The visual-editor media bridge uploads a base64 image inside a JSON
      // body; raise the parser limit above MAX_UPLOAD_BYTES (10MB) inflated by
      // base64 (~1.34x) so the friendly file-size check — not a raw 413 —
      // rejects oversized files.
      method: ["POST"],
      matcher: "/cms/media",
      bodyParser: { sizeLimit: 15 * 1024 * 1024 },
    },
    {
      // Fail-closed call-center RBAC (all methods). Protects the routes
      // regardless of CALL_CENTER_ENABLED.
      matcher: "/admin/call-center/*",
      middlewares: [requireCallCenterAccess],
    },
    {
      // Coarse shared-secret gate for inbound telephony webhooks (all methods).
      // Provider signature verification happens in-handler.
      matcher: "/telephony/*",
      middlewares: [requireTelephonySecret],
    },
    {
      // Fail-closed marketing RBAC (all methods).
      matcher: "/admin/marketing/*",
      middlewares: [requireMarketingAccess],
    },
    // Inbound marketing webhooks (`/marketing-webhooks/*`) and the public
    // storefront chat API (`/marketing-chat/*`) are intentionally NOT gated
    // here: real platform webhooks (Meta `X-Hub-Signature-256`, Telegram
    // secret token) authenticate with their OWN per-request signatures, which
    // are verified in-handler via each MessagingProvider.verifyWebhook — a
    // shared header gate would reject every legitimate provider callback.
    // `/marketing-oauth/*` is likewise open (state-validated in-handler).
    {
      // Preserve the exact raw request bytes for `/marketing-webhooks/*` so
      // Meta HMAC-SHA256 signature verification can hash the byte-identical
      // body (a re-serialized JSON object would not match). Exposed to handlers
      // as `req.rawBody`.
      matcher: "/marketing-webhooks/*",
      bodyParser: { preserveRawBody: true },
    },
    {
      // Stripe payment webhooks must receive the raw request bytes so the
      // `stripe-signature` header can be verified against the exact payload
      // Medusa's JSON parser re-serializes; preserveRawBody keeps the original
      // buffer on `req.rawBody`.
      matcher: "/webhooks/payment/*",
      bodyParser: { preserveRawBody: true },
    },
  ],
})
