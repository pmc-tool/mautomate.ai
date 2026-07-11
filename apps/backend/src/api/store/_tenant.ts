import type { MedusaRequest } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

/**
 * Store-facing tenant resolver for the pooled multi-tenant model.
 *
 * Mirrors `modules/cms/tenant-scope.ts#cmsTenantId` EXACTLY (same headers, same
 * platform lookups) but additionally returns the tenant's dedicated
 * `meta.region_id`, so commerce store routes can scope by BOTH the region id and
 * `metadata.tenant_id`.
 *
 * Every storefront request carries the tenant's publishable key
 * (`x-publishable-api-key`, auto-injected by the storefront SDK in multi-tenant
 * mode); we map that key to its owning tenant. Falls back to the
 * middleware-injected `x-tenant-id`.
 *
 * Returns null when no tenant can be determined. Callers MUST fail closed on
 * null (return an EMPTY list / 404) — never fall back to unscoped global rows,
 * which is exactly the cross-tenant leak this closes.
 */
export type StoreTenant = {
  id: string
  region_id: string | null
  meta: Record<string, any> | null
}

export async function storeTenant(
  req: MedusaRequest
): Promise<StoreTenant | null> {
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
      const t = rows?.[0]
      if (t?.id) {
        return { id: t.id as string, region_id: t.meta?.region_id ?? null, meta: t.meta ?? null }
      }
    }
    if (direct) {
      const t = await platform.retrieveTenant(direct).catch(() => null)
      if (t?.id) {
        return { id: t.id as string, region_id: t.meta?.region_id ?? null, meta: t.meta ?? null }
      }
    }
  } catch {
    // fall through to null (fail closed)
  }
  return null
}
