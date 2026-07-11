import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"

/**
 * GET /admin/cms/audit-log
 *
 * Read-only, paginated audit trail, NEWEST FIRST. Visible to all CMS roles
 * (admin + editor + viewer) — it's a GET, which the `/admin/cms/*` matrix allows
 * for every role; viewers are read-only by construction.
 *
 * Filters (all optional, AND-combined):
 *   action?       — exact match (e.g. "page.publish", "role.update")
 *   entity_type?  — exact match (e.g. "page", "global_setting", "cms_role")
 *   actor_id?     — exact match (the acting user id)
 *   from? / to?   — ISO timestamps; created_at range ($gte / $lte)
 *   limit (≤200, default 50), offset (default 0)
 *
 * Response: { audit_logs, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: only surface the acting store's audit trail.
  // Fail-closed — an unresolved tenant sees an empty log.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ audit_logs: [], count: 0, limit: 0, offset: 0 })
    return
  }

  const action = (req.query.action as string | undefined)?.trim()
  const entityType = (req.query.entity_type as string | undefined)?.trim()
  const actorId = (req.query.actor_id as string | undefined)?.trim()
  const from = (req.query.from as string | undefined)?.trim()
  const to = (req.query.to as string | undefined)?.trim()

  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  const filters: Record<string, unknown> = { tenant_id: tenantId }
  if (action) filters.action = action
  if (entityType) filters.entity_type = entityType
  if (actorId) filters.actor_id = actorId

  const createdAt: Record<string, Date> = {}
  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) createdAt.$gte = d
  }
  if (to) {
    const d = new Date(to)
    if (!isNaN(d.getTime())) createdAt.$lte = d
  }
  if (Object.keys(createdAt).length) {
    filters.created_at = createdAt
  }

  const [auditLogs, count] = await service.listAndCountCmsAuditLogs(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.json({ audit_logs: auditLogs, count, limit, offset })
}
