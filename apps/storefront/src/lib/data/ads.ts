import { getTenantContext } from "@lib/tenant"

/**
 * The tenant's Meta pixel id, threaded from /tenant-config through the
 * storefront middleware as the x-tenant-metapixel header (same proven path as
 * theme / umami). The root layout injects the base pixel (PageView) when this
 * is present. Derived server-side from the tenant — a store can only ever get
 * its own pixel.
 */
export async function getMetaPixelId(): Promise<string | null> {
  try {
    const ctx = await getTenantContext()
    return ctx?.metaPixelId ?? null
  } catch {
    return null
  }
}
