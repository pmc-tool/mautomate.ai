import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

/** GET /admin/platform/domains — every connected domain across all tenants. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [domains, tenants] = await Promise.all([
    svc.listTenantDomains({}),
    svc.listTenants({}),
  ])
  const nameById: Record<string, string> = {}
  for (const t of tenants) nameById[t.id] = t.name
  res.json({
    domains: (domains || []).map((d: any) => ({
      id: d.id,
      domain: d.domain,
      tenant: nameById[d.tenant_id] || d.tenant_id,
      type: d.type,
      is_primary: d.is_primary,
      ssl_status: d.ssl_status,
      verification_status: d.verification_status,
    })),
  })
}
