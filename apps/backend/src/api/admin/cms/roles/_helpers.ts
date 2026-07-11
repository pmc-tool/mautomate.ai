import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import type CmsModuleService from "../../../../modules/cms/service"
import type { CmsRole } from "../../../../modules/cms/role-helper"
import { getActor } from "../settings/_helpers"

/**
 * Shared helpers for the admin Roles routes. Non-`route.ts` / `middlewares.ts`
 * files are ignored by Medusa's file-based router, so this is import-only (the
 * leading underscore makes that explicit).
 */

/** A core admin user joined with its effective CMS role. */
export type RoleListEntry = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: CmsRole
  /** true when the role is the implicit "admin" fail-safe (no explicit row). */
  is_default: boolean
}

/**
 * Defense-in-depth admin assertion. The `/admin/cms/roles*` middleware already
 * restricts the whole area to admins; this re-checks `req.cms_actor.role` inside
 * the handler so the last-admin invariant + role mutations can never be reached
 * by a non-admin even if the matcher were ever loosened.
 */
export function assertAdminActor(req: MedusaRequest): void {
  const role = (req as any).cms_actor?.role
  if (role !== "admin") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only a CMS admin may manage roles."
    )
  }
}

/** Fetch all core admin users (Modules.USER). Returns [] if the module fails. */
export async function listAllUsers(
  req: MedusaRequest
): Promise<Array<{ id: string; email?: string; first_name?: string; last_name?: string }>> {
  try {
    const userModule: any = req.scope.resolve(Modules.USER)
    const users = await userModule.listUsers(
      {},
      { take: 1000, order: { email: "ASC" } }
    )
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

/**
 * Compute the set of user ids that are EFFECTIVE admins given the current role
 * rows and the full user list. A user is an effective admin unless they have an
 * explicit non-admin (editor/viewer) row — because the no-row default is "admin".
 */
function effectiveAdminIds(
  allUserIds: string[],
  roleRows: Array<{ user_id: string; role: string }>
): Set<string> {
  const explicitNonAdmin = new Set(
    roleRows.filter((r) => r.role !== "admin").map((r) => r.user_id)
  )
  return new Set(allUserIds.filter((id) => !explicitNonAdmin.has(id)))
}

/**
 * Last-admin invariant guard. Simulates setting `targetUserId` to `nextRole` and
 * throws 403 if that would leave ZERO effective CMS admins. Used by PUT (a
 * downgrade is the only way to violate it); DELETE can only ever ADD an admin
 * back (no-row ⇒ admin), so it never trips this.
 *
 * If the user list can't be loaded we conservatively count only explicit role
 * rows, still guaranteeing at least one admin row survives.
 */
export async function assertNotLastAdmin(
  req: MedusaRequest,
  service: CmsModuleService,
  targetUserId: string,
  nextRole: CmsRole
): Promise<void> {
  if (nextRole === "admin") {
    return // promoting/keeping admin can never remove the last admin
  }

  const roleRows: Array<{ user_id: string; role: string }> =
    (await (service as any).listCmsUserRoles({})) ?? []

  const users = await listAllUsers(req)
  const allUserIds = users.length
    ? users.map((u) => u.id)
    : // Fallback: no user list — treat known explicit-admin rows as the universe.
      Array.from(
        new Set([
          targetUserId,
          ...roleRows.filter((r) => r.role === "admin").map((r) => r.user_id),
        ])
      )

  const admins = effectiveAdminIds(allUserIds, roleRows)
  // Simulate the change: target becomes a non-admin.
  admins.delete(targetUserId)

  if (admins.size === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot downgrade the last remaining CMS admin. Assign another admin first."
    )
  }
}

/**
 * Write a cms_audit_log row for a role change (action "role.update"). Best-effort
 * & non-blocking — an audit failure must never roll back the role mutation (§8.3).
 */
export async function recordRoleAudit(
  req: MedusaRequest,
  service: CmsModuleService,
  targetUserId: string,
  diff: { before?: unknown; after?: unknown }
): Promise<void> {
  try {
    const actor = await getActor(req)
    await service.createCmsAuditLogs({
      actor_id: actor.user_id,
      actor_email: actor.email,
      action: "role.update",
      entity_type: "cms_role",
      entity_key: targetUserId,
      before: (diff.before ?? null) as any,
      after: (diff.after ?? null) as any,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] role audit log write failed (non-blocking):", e)
  }
}
