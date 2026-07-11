import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"
import {
  CALL_CENTER_ROLES,
  isCallCenterRole,
} from "../../../../modules/call-center/role-helper"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * Supervisor-only call-center role management.
 *
 * This route lives UNDER `/admin/call-center/*`, so `requireCallCenterAccess`
 * already gates it: `canCallCenterAccess` reserves this whole surface (not in
 * the agent read/write allowlist) to "supervisor". We additionally re-check
 * `req.call_center_actor.role === "supervisor"` here (defense in depth) so role
 * mutation can never be reached by an agent even if the matcher were loosened.
 *
 *   GET    /admin/call-center/roles           list roles for this tenant
 *   POST   /admin/call-center/roles           grant/upsert { user_id|email, role }
 *   DELETE /admin/call-center/roles           revoke { user_id }
 */
function assertSupervisor(req: AuthenticatedMedusaRequest): void {
  const role = (req as any).call_center_actor?.role
  if (role !== "supervisor") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only a call-center supervisor may manage roles."
    )
  }
}

/** Resolve a core admin user id from an explicit user_id or an email. */
async function resolveUserId(
  req: AuthenticatedMedusaRequest,
  userId?: string,
  email?: string
): Promise<string> {
  const trimmedId = userId?.trim()
  if (trimmedId) {
    return trimmedId
  }
  const trimmedEmail = email?.trim()
  if (!trimmedEmail) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A `user_id` or `email` is required."
    )
  }
  const userModule: any = req.scope.resolve(Modules.USER)
  const users = await userModule.listUsers({ email: trimmedEmail })
  const user = Array.isArray(users) ? users[0] : users
  if (!user?.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No admin user found for email ${trimmedEmail}.`
    )
  }
  return user.id
}

function toStatus(e: any): number {
  switch (e?.type) {
    case MedusaError.Types.INVALID_DATA:
      return 400
    case MedusaError.Types.NOT_FOUND:
      return 404
    case MedusaError.Types.NOT_ALLOWED:
      return 403
    default:
      return 500
  }
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    assertSupervisor(req)
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)
    const roles = (await cc.listAgentRoles({ tenant_id: TENANT_ID })) ?? []
    res.status(200).json({ agent_roles: roles })
  } catch (e: any) {
    res
      .status(toStatus(e))
      .json({ message: e?.message ?? "Failed to list call-center roles" })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    user_id?: string
    email?: string
    role?: string
  }

  try {
    assertSupervisor(req)

    const role = body.role?.trim() ?? "agent"
    if (!isCallCenterRole(role)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `\`role\` must be one of: ${CALL_CENTER_ROLES.join(", ")}.`
      )
    }

    const userId = await resolveUserId(req, body.user_id, body.email)
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const existing =
      (await cc.listAgentRoles({
        tenant_id: TENANT_ID,
        user_id: userId,
      })) ?? []
    const existingRow = Array.isArray(existing) ? existing[0] : existing

    let row = existingRow
    if (existingRow) {
      const updated = await cc.updateAgentRoles({
        id: (existingRow as any).id,
        role,
      })
      row = Array.isArray(updated) ? updated[0] : updated
    } else {
      const created = await cc.createAgentRoles({
        tenant_id: TENANT_ID,
        user_id: userId,
        role,
      })
      row = Array.isArray(created) ? created[0] : created
    }

    res.status(200).json({ agent_role: row })
  } catch (e: any) {
    res
      .status(toStatus(e))
      .json({ message: e?.message ?? "Failed to grant call-center role" })
  }
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as { user_id?: string; email?: string }

  try {
    assertSupervisor(req)

    const userId = await resolveUserId(req, body.user_id, body.email)
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const existing =
      (await cc.listAgentRoles({
        tenant_id: TENANT_ID,
        user_id: userId,
      })) ?? []
    const rows = Array.isArray(existing) ? existing : existing ? [existing] : []

    for (const r of rows) {
      await cc.deleteAgentRoles((r as any).id)
    }

    res
      .status(200)
      .json({ user_id: userId, object: "call_center_agent_role", deleted: true })
  } catch (e: any) {
    res
      .status(toStatus(e))
      .json({ message: e?.message ?? "Failed to revoke call-center role" })
  }
}
