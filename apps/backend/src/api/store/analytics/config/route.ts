import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import { getOrCreateTenantWebsite, umamiConfigured } from "../../../../lib/umami"

/**
 * GET /store/analytics/config — the storefront asks "what's my Umami website id?"
 *
 * Resolves the tenant from the request (publishable key / host, exactly like the
 * CMS store reads) and returns THAT tenant's website id, creating it on first
 * use. Public (no merchant auth) but tenant-scoped by the publishable key — a
 * storefront can only ever get its own tenant's id. The storefront injects it
 * into its tracking script so each store's traffic lands in its own bucket.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!umamiConfigured()) {
    return res.json({ website_id: null })
  }
  try {
    const tenantId = await cmsTenantId(req).catch(() => null)
    if (!tenantId) return res.json({ website_id: null })

    const svc: any = req.scope.resolve(PLATFORM_MODULE)
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
    if (!tenant) return res.json({ website_id: null })

    const websiteId = await getOrCreateTenantWebsite(svc, tenant)
    res.set("cache-control", "public, max-age=300")
    res.json({ website_id: websiteId })
  } catch {
    res.json({ website_id: null })
  }
}
