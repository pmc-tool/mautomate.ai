import "server-only"

import { getTenantContext } from "@lib/tenant"

/**
 * Per-tenant promotion code namespacing (storefront side).
 *
 * The pooled mAutomate backend stores each tenant's promotion under a
 * tenant-namespaced internal `code` (t_<tenant_id>_<CODE>) so two tenants can
 * both own "SAVE10" without colliding. Customers still type the plain code, so
 * on apply we translate the plain code -> the current tenant's internal code,
 * and when displaying the cart we translate back. The tenant is resolved
 * SERVER-SIDE from the request Host (x-tenant-id), never from client input, so a
 * customer on tenant X can only ever address tenant X's code space.
 *
 * Single-tenant mode (Forever Finds, MULTI_TENANT off) has no tenant context, so
 * every function is a pass-through and behavior is byte-for-byte unchanged.
 *
 * NOTE: keep sanitize/prefix IN SYNC with the backend's
 * apps/backend/src/api/merchant/discounts/_promo-code.ts.
 */

function sanitizeTenantId(tenantId: string): string {
  return (tenantId || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

function tenantPrefix(tenantId: string): string {
  return `t_${sanitizeTenantId(tenantId)}_`
}

function namespaceCodeFor(tenantId: string, input: string): string {
  const prefix = tenantPrefix(tenantId)
  const trimmed = (input || "").trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith(prefix)) return trimmed
  return `${prefix}${trimmed.toUpperCase()}`
}

function denamespaceCodeFor(tenantId: string, code: string): string {
  const prefix = tenantPrefix(tenantId)
  return code && code.startsWith(prefix) ? code.slice(prefix.length) : code
}

/** Customer-entered code -> internal code for the current tenant (or unchanged). */
export async function toInternalPromoCode(input: string): Promise<string> {
  const tenant = await getTenantContext()
  if (!tenant) return input
  return namespaceCodeFor(tenant.id, input)
}

/** Map many customer-entered codes to the current tenant's internal codes. */
export async function toInternalPromoCodes(inputs: string[]): Promise<string[]> {
  const tenant = await getTenantContext()
  if (!tenant) return inputs
  return inputs.map((c) => namespaceCodeFor(tenant.id, c))
}

/** Internal code -> plain DISPLAY code for the current tenant (or unchanged). */
export async function toDisplayPromoCode(code: string): Promise<string> {
  const tenant = await getTenantContext()
  if (!tenant) return code
  return denamespaceCodeFor(tenant.id, code)
}
