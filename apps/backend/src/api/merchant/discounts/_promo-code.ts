/**
 * Per-tenant promotion code namespacing (pooled multi-tenant safety).
 *
 * Promotion `code` is GLOBALLY UNIQUE in a single Medusa instance, so two pooled
 * tenants sharing one backend cannot both own the plain code "SAVE10" — a
 * cross-tenant collision. We therefore store the merchant-entered code as the
 * DISPLAY code (metadata.display_code) and set the real promotion `code` to a
 * tenant-namespaced value that can never collide with another tenant:
 *
 *   internal code  =  t_<sanitized_full_tenant_id>_<DISPLAY_UPPERCASED>
 *
 * The FULL tenant id (not a short prefix) is used so codes are unique even for
 * tenants whose ids share a leading timestamp component (ULID-style ids do).
 * The merchant + their customers only ever see/type the plain DISPLAY code.
 */

/** Strip a tenant id down to a stable [a-z0-9] token usable inside a code. */
export function sanitizeTenantId(tenantId: string): string {
  return (tenantId || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

/** The unique per-tenant prefix every namespaced code carries. */
export function tenantPrefix(tenantId: string): string {
  return `t_${sanitizeTenantId(tenantId)}_`
}

/**
 * Merchant-entered DISPLAY code -> globally-unique internal promotion code.
 * Idempotent: passing an already-namespaced code returns it unchanged.
 * The display portion is upper-cased so matching is effectively case-insensitive.
 */
export function namespaceCode(tenantId: string, input: string): string {
  const prefix = tenantPrefix(tenantId)
  const trimmed = (input || "").trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith(prefix)) return trimmed
  return `${prefix}${trimmed.toUpperCase()}`
}

/**
 * Internal promotion code -> DISPLAY code for THIS tenant. Best-effort: strips
 * the tenant prefix when present, otherwise returns the code unchanged (so
 * pre-namespacing / legacy plain codes still render sensibly).
 */
export function denamespaceCode(tenantId: string, code: string): string {
  const prefix = tenantPrefix(tenantId)
  return code && code.startsWith(prefix) ? code.slice(prefix.length) : code
}
