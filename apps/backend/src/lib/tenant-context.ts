import { AsyncLocalStorage } from "async_hooks"

/**
 * Request-scoped tenant identity for the shared (pooled) mAutomate backend.
 *
 * In the pooled model many tenants share one Node process. Code paths that
 * need the current tenant (payment providers, encrypted config, etc.) cannot
 * rely on process.env.TENANT_ID. Instead the request handler sets the tenant
 * id in this AsyncLocalStorage store, and downstream async work reads it.
 *
 * Resolution order in resolveTenantId():
 *   1. Request-scoped tenant from AsyncLocalStorage
 *   2. process.env.TENANT_ID (legacy instance-per-tenant containers)
 *   3. Legacy env var fallback (e.g. MARKETING_DEFAULT_TENANT)
 *   4. "default" — only as a last resort for un-migrated single-tenant paths
 */

type TenantContext = { tenantId: string }

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

/** Run fn with tenantId in the current async context. */
export const withTenant = <T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> =>
  tenantStorage.run({ tenantId }, fn) as Promise<T>

/** Return the tenant id active in the current async context, if any. */
export const getCurrentTenantId = (): string | undefined =>
  tenantStorage.getStore()?.tenantId

/** Legacy boot constant. */
export const BOOT_TENANT_ID: string | undefined = (() => {
  const raw = process.env.TENANT_ID
  return raw && raw.trim().length > 0 ? raw.trim() : undefined
})()

export const requireTenantId = (): string => {
  const current = getCurrentTenantId()
  if (current) return current
  if (BOOT_TENANT_ID) return BOOT_TENANT_ID
  throw new Error("TENANT_ID is not set and no request tenant context is active")
}

/**
 * Resolve the active tenant id.
 *
 * FAIL-CLOSED for WRITES: the trailing `"default"` fallback is a fail-OPEN that
 * lets an un-tenanted request silently write to a shared "default" tenant — a
 * cross-tenant hazard. It is now GUARDED behind `allowDefault` (default true so
 * legacy single-tenant READ / webhook / marketing-widget / session-channel paths
 * that legitimately run without a request tenant keep working). Any WRITE that
 * must never land on a shared tenant MUST pass `{ allowDefault: false }` (or use
 * `requireTenantId()` / the CMS `requireWriteTenant()` helper), which throws
 * instead of inventing "default".
 */
export const resolveTenantId = (
  legacyEnv?: string,
  opts?: { allowDefault?: boolean }
): string => {
  const allowDefault = opts?.allowDefault ?? true
  const current = getCurrentTenantId()
  if (current) return current
  const boot = process.env.TENANT_ID?.trim()
  if (boot) return boot
  const legacy = legacyEnv ? process.env[legacyEnv]?.trim() : undefined
  if (legacy) return legacy
  if (!allowDefault) {
    throw new Error(
      "No tenant is resolvable for this request and the shared 'default' " +
        "fallback is disabled (fail-closed write path)."
    )
  }
  return "default"
}
