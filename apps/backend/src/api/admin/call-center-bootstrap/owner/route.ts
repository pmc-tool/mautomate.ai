import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

/**
 * POST /admin/call-center-bootstrap/owner
 *
 * ACCESS UNBLOCK (Phase 0). A freshly-provisioned store owner is FAIL-CLOSED out
 * of every `/admin/call-center/*` route by `requireCallCenterAccess` until an
 * explicit `call_center_agent_role` (role "supervisor") row exists for them.
 * This route is deliberately mounted OUTSIDE `/admin/call-center/*`, so the
 * fail-closed guard does NOT gate it — only Medusa's built-in `/admin`
 * `authenticate` middleware applies. It bootstraps the very first supervisor.
 *
 * PROVISIONING: after provisioning a store, POST here (authenticated as the new
 * owner admin user) to grant that first owner supervisor access:
 *   POST /admin/call-center-bootstrap/owner
 *
 * FIRST-OWNER GUARD: once ANY supervisor row exists for this tenant this route
 * is a no-op (returns { already_initialized: true }), so it can never be used to
 * self-escalate a second admin into a supervisor after setup. Ongoing agent/
 * supervisor management is done via the supervisor-only
 * `/admin/call-center/roles` route.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const auth = (req as any).auth_context ?? {}
  const actorId: string | undefined = auth.actor_id
  const actorType: string | undefined = auth.actor_type

  // Authn: require a real admin USER. Anything else → 401.
  if (!actorId || actorType !== "user") {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const tenantId = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    // FIRST-OWNER GUARD: if a supervisor already exists for this tenant, do
    // nothing (prevents self-escalation once the store is set up).
    const supervisors =
      (await cc.listAgentRoles({
        tenant_id: tenantId,
        role: "supervisor",
      })) ?? []
    if (Array.isArray(supervisors) ? supervisors.length : supervisors) {
      res.status(200).json({ already_initialized: true })
      return
    }

    // Idempotent upsert (list-then-create): grant this actor supervisor.
    const existing =
      (await cc.listAgentRoles({
        tenant_id: tenantId,
        user_id: actorId,
      })) ?? []
    const existingRow = Array.isArray(existing) ? existing[0] : existing

    let row = existingRow
    if (existingRow) {
      const updated = await cc.updateAgentRoles({
        id: (existingRow as any).id,
        role: "supervisor",
      })
      row = Array.isArray(updated) ? updated[0] : updated
    } else {
      const created = await cc.createAgentRoles({
        tenant_id: tenantId,
        user_id: actorId,
        role: "supervisor",
      })
      row = Array.isArray(created) ? created[0] : created
    }

    res.status(200).json({ initialized: true, agent_role: row })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to bootstrap call-center owner",
    })
  }
}
