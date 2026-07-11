import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../platform"
import { resolveMerchant } from "../../api/merchant/_helpers"

/**
 * Resolve a tenant id from the request's tenant HEADERS (the store's publishable
 * key, or the storefront-forwarded `x-tenant-pak` / `x-tenant-id`). Returns null
 * when none resolve.
 *
 * IMPORTANT: a publishable key is client-visible/semi-public. The value returned
 * here is therefore only trustworthy for READS (see `cmsTenantId`) or when the
 * caller has independently proven it came from a trusted principal (a signed
 * merchant identity, or the secret-gated storefront proxy — see
 * `requireWriteTenant`). Never scope a WRITE off this alone.
 */
async function headerTenantId(req: MedusaRequest): Promise<string | null> {
  const h: any = req.headers || {}
  const pak: string =
    (h["x-publishable-api-key"] as string) || (h["x-tenant-pak"] as string) || ""
  const direct: string = (h["x-tenant-id"] as string) || ""
  try {
    const platform: any = req.scope.resolve(PLATFORM_MODULE)
    if (pak) {
      const rows = await platform.listTenants(
        { publishable_key: pak },
        { take: 1 }
      )
      if (rows?.[0]?.id) return rows[0].id as string
    }
    if (direct) {
      const t = await platform.retrieveTenant(direct).catch(() => null)
      if (t?.id) return t.id as string
    }
  } catch {
    // fall through to null
  }
  return null
}

/**
 * Resolve the CMS tenant for a READ request (pooled multi-tenant model).
 *
 * Every storefront + visual-editor request carries the tenant's publishable key
 * (`x-publishable-api-key`, auto-injected by the storefront SDK in multi-tenant
 * mode and by the Puck editor proxy), so we map that key to its owning tenant
 * and scope CMS content per store. Falls back to the middleware-injected
 * `x-tenant-id` / `x-tenant-pak`.
 *
 * Returns null when no tenant can be determined: reads then fall back to the
 * inline CMS defaults / an empty list. WRITES must NOT use this — a publishable
 * key is spoofable, so writes go through `requireWriteTenant` instead.
 */
export async function cmsTenantId(req: MedusaRequest): Promise<string | null> {
  return headerTenantId(req)
}

/**
 * Timing-safe secret compare (hash first so length is never leaked). Mirrors the
 * `x-cms-secret` check in the visual-editor bridge routes.
 */
function safeSecretEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

/**
 * Does this request carry a VALID visual-editor server-to-server secret
 * (`x-cms-secret === CMS_REVALIDATE_SECRET`)? The secret is server-only (it
 * never ships to the browser), so a valid secret proves the request transited
 * the trusted storefront proxy — the only holder of the secret.
 */
function hasValidVisualEditorSecret(req: MedusaRequest): boolean {
  const provided = (req.headers as any)?.["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  return (
    !!expected &&
    typeof provided === "string" &&
    safeSecretEqual(provided, expected)
  )
}

/**
 * Resolve the tenant a CMS WRITE must be scoped to — derived from the
 * AUTHENTICATED principal, NEVER from the client-visible publishable key alone.
 * This is the fail-closed guard that closes the cross-tenant write loophole:
 * presenting another store's public pak does NOT grant write access.
 *
 * Precedence (strongest trust first):
 *
 *   1. Signed merchant identity (actor_type "merchant", unforgeable JWT) ->
 *      merchant.tenant_id. If a pak / tenant header is ALSO present and resolves
 *      to a DIFFERENT tenant we REJECT — the spoofable pak is never trusted over
 *      the signed identity.
 *
 *   2. Secret-gated visual-editor bridge: a valid `x-cms-secret` proves the
 *      request came from the trusted storefront proxy, which resolves the store
 *      from the request Host server-side (control-plane /tenant-config) and
 *      forwards it as `x-tenant-pak`. We trust THAT proxy assertion because the
 *      browser cannot mint the secret. A raw pak with no secret never reaches
 *      these routes, so it grants nothing.
 *
 *   3. Admin user (actor_type "user") on the operator `/admin/cms/*` surface.
 *      The tenant comes from the forwarded pak / `x-tenant-id`. Merchants can
 *      never reach `/admin/cms/*` (its guard requires actor_type "user"), so
 *      this is an operator-only surface, not a merchant cross-tenant vector.
 *
 * Fail-closed: throws (never a shared/"default" tenant) when no trusted
 * principal yields a tenant.
 */
export async function requireWriteTenant(req: MedusaRequest): Promise<string> {
  const auth = (req as any).auth_context ?? {}

  // 1. Signed merchant identity wins; the pak may only agree, never override.
  if (auth.actor_type === "merchant" && auth.actor_id) {
    const ctx = await resolveMerchant(req)
    if (!ctx) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Your merchant account is not active for this store."
      )
    }
    const claimed = await headerTenantId(req)
    if (claimed && claimed !== ctx.tenant.id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The store key on this request does not match your account."
      )
    }
    return ctx.tenant.id
  }

  // 2. Trusted storefront proxy asserting the tenant via the secret gate.
  if (hasValidVisualEditorSecret(req)) {
    const tenantId = await headerTenantId(req)
    if (!tenantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Could not determine the store for this write."
      )
    }
    return tenantId
  }

  // 3. Operator admin user on /admin/cms/*.
  if (auth.actor_type === "user" && auth.actor_id) {
    const tenantId = await headerTenantId(req)
    if (!tenantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Could not determine your store from the request. Reload the editor and try again."
      )
    }
    return tenantId
  }

  // No trusted principal — fail closed.
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "A trusted, authenticated store identity is required for this operation."
  )
}
