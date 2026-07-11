import { getTenantContext } from "@lib/tenant"

/**
 * The tenant's Umami website id, threaded from /tenant-config through the
 * storefront middleware as the x-tenant-umami header (same proven path as theme
 * / region). The root layout injects the tracking script when this is present.
 * Derived server-side from the tenant — a store can only ever get its own id.
 */
export async function getAnalyticsWebsiteId(): Promise<string | null> {
  try {
    const ctx = await getTenantContext()
    return ctx?.umamiWebsiteId ?? null
  } catch {
    return null
  }
}
