import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../../../modules/platform"
import { SuperAdminService } from "../../../../../modules/platform/super-admin"
import { getInfraExecutor } from "../../../../../modules/platform/provider/executor"
import { aggregateUsage } from "../../../../../modules/platform/observability/reconciliation"
import { actorFromReq } from "../../_actor"

/** GET /admin/platform/tenants/:id — detail: subscription, usage, audit trail. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const svc = req.scope.resolve(PLATFORM_MODULE) as any
  const admin = new SuperAdminService(req.scope)

  const tenant = await svc.retrieveTenant(id)
  const domains = await svc.listTenantDomains({ tenant_id: id })
  const usage = await svc.listUsageEvents({ tenant_id: id })
  const wallets = await svc.listCreditWallets({ tenant_id: id }, { take: 1 })
  const audit = await admin.auditTrail(id)

  res.json({
    tenant,
    domains,
    wallet: wallets?.[0] ?? null,
    usage_by_action: aggregateUsage(
      (usage ?? []).map((u: any) => ({
        action: u.action,
        units: Number(u.units ?? 0),
        credits: Number(u.credits ?? 0),
        vendor_cost_usd: u.vendor_cost_usd,
      }))
    ),
    audit,
  })
}

/** DELETE /admin/platform/tenants/:id — de-provision (irreversible). */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  // Capture the instance pointers BEFORE the tenant row is removed, then tear
  // down the dedicated instance (stop process + drop its database).
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(id).catch(() => null)
  const admin = new SuperAdminService(req.scope)
  const out = await admin.deprovision(actorFromReq(req), id)
  if (tenant?.container_ref || tenant?.db_name) {
    await getInfraExecutor().destroyInstance({
      tenant_id: id,
      container_ref: tenant?.container_ref ?? undefined,
      db_name: tenant?.db_name ?? undefined,
    })
  }
  res.json(out)
}
