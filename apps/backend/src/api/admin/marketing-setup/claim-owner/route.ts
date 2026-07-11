import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { resolveTenantId } from "../../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../../modules/marketing"

/**
 * POST /admin/marketing-setup/claim-owner
 *
 * Bootstraps the FIRST marketing "admin" for this instance's tenant so a store
 * owner is not locked out of /admin/marketing/* by the fail-closed RBAC guard
 * (absence of a marketing_agent_role row = no access).
 *
 * Mounted DELIBERATELY OUTSIDE /admin/marketing/* so the fail-closed marketing
 * guard (matcher "/admin/marketing/*") does NOT gate it — it relies solely on
 * the built-in /admin authentication, which every /admin route already gets.
 *
 * FIRST-OWNER GUARD: if any marketing admin already exists for this tenant we
 * return 200 { already_initialized: true } and do nothing, so a later,
 * lower-privileged admin user cannot silently escalate themselves. Otherwise we
 * idempotently (list-then-create) grant the caller the "admin" role, which is
 * full marketing access per canMarketingAccess.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const authContext = (req as any).auth_context
  const actorId: string | undefined = authContext?.actor_id
  const actorType: string | undefined = authContext?.actor_type

  if (!actorId || actorType !== "user") {
    res.status(401).json({ message: "Not authenticated as an admin user" })
    return
  }

  const tenantId = resolveTenantId("MARKETING_DEFAULT_TENANT")
  const svc: any = req.scope.resolve(MARKETING_MODULE)

  // First-owner guard: any existing admin means this is already initialized.
  const existingAdmins = await svc.listMarketingAgentRoles({
    tenant_id: tenantId,
    role: "admin",
  })
  const hasAdmin = Array.isArray(existingAdmins)
    ? existingAdmins.length > 0
    : !!existingAdmins
  if (hasAdmin) {
    res.status(200).json({ already_initialized: true })
    return
  }

  // Idempotent upsert for THIS user (list-then-create, mirrors the seed script).
  const mine = await svc.listMarketingAgentRoles({
    tenant_id: tenantId,
    user_id: actorId,
  })
  const alreadyMine = Array.isArray(mine) ? mine.length > 0 : !!mine
  if (!alreadyMine) {
    await svc.createMarketingAgentRoles({
      tenant_id: tenantId,
      user_id: actorId,
      role: "admin",
    })
  }

  res.status(200).json({
    granted: true,
    tenant_id: tenantId,
    user_id: actorId,
    role: "admin",
  })
}
