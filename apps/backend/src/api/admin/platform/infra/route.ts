import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

/** GET /admin/platform/infra — provisioning jobs + tenant instance pointers. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [jobs, tenants] = await Promise.all([
    svc.listProvisioningJobs({}, { take: 100, order: { created_at: "DESC" } }),
    svc.listTenants({}),
  ])
  const nameById: Record<string, string> = {}
  for (const t of tenants) nameById[t.id] = t.name
  res.json({
    provisioner: process.env.PROVISIONER_MODE || "dry-run",
    instances: (tenants || []).map((t: any) => ({
      tenant: t.name, slug: t.slug, status: t.status,
      backend_url: t.backend_url, container_ref: t.container_ref, db_name: t.db_name,
    })),
    jobs: (jobs || []).map((j: any) => ({
      id: j.id, tenant: nameById[j.tenant_id] || j.tenant_id, status: j.status,
      current_step: j.current_step, attempts: j.attempts, at: j.created_at,
    })),
  })
}
