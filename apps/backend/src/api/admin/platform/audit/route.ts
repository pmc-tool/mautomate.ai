import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

/** GET /admin/platform/audit — recent operator audit trail (newest first). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const rows = await svc.listAuditLogs({}, { take: 200, order: { created_at: "DESC" } })
  res.json({
    entries: (rows || []).map((a: any) => ({
      id: a.id, action: a.action, actor: a.actor, tenant_id: a.tenant_id,
      outcome: a.outcome, ip: a.ip, meta: a.meta, at: a.created_at,
    })),
  })
}
