import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { removeUserAccountWorkflow } from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../../../modules/cms"
import type CmsModuleService from "../../../../../modules/cms/service"

/**
 * DELETE /admin/cms/users/:id   (admin-gated by the /admin/cms/* middleware)
 *
 * Permanently remove an admin user: deletes the user + unlinks its auth
 * identity (via the core remove-user-account workflow) and drops its CMS role
 * row. Guarded so an admin can neither delete their own account nor remove the
 * last remaining admin (which would lock everyone out of CMS management).
 */
type CmsRole = "admin" | "editor" | "viewer"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const targetId = req.params.id
  const currentUserId = (req as any).auth_context?.actor_id as
    | string
    | undefined

  if (currentUserId && currentUserId === targetId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You cannot remove your own account."
    )
  }

  const userService: any = req.scope.resolve(Modules.USER)
  const authService: any = req.scope.resolve(Modules.AUTH)
  const cms: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const target = (await userService.listUsers({ id: targetId }))?.[0]
  if (!target) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `User ${targetId} was not found.`
    )
  }

  // Effective role = explicit CMS role row, else "admin" (the default).
  const [allUsers, roleRows] = await Promise.all([
    userService.listUsers({}, { take: 1000 }),
    cms.listCmsUserRoles({}),
  ])
  const explicit = new Map<string, CmsRole>(
    (roleRows ?? []).map((r: any) => [r.user_id, r.role])
  )
  const effectiveRole = (uid: string): CmsRole => explicit.get(uid) ?? "admin"
  const adminCount = (allUsers ?? []).filter(
    (u: any) => effectiveRole(u.id) === "admin"
  ).length

  if (effectiveRole(targetId) === "admin" && adminCount <= 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You cannot remove the last admin. Assign another admin first."
    )
  }

  // Drop the CMS role row (best-effort) before removing the account.
  const ownRoleRows = (roleRows ?? []).filter(
    (r: any) => r.user_id === targetId
  )
  if (ownRoleRows.length) {
    try {
      await cms.deleteCmsUserRoles(ownRoleRows.map((r: any) => r.id))
    } catch {
      // non-blocking
    }
  }

  // Capture the linked auth identities BEFORE the workflow unlinks them, so we
  // can fully delete the credential afterwards. Without this the workflow only
  // unlinks the identity and the deleted user's email/password would still
  // authenticate (return a token) — a real security gap.
  let authIdentityIds: string[] = []
  try {
    const identities = await authService.listAuthIdentities({
      app_metadata: { user_id: targetId },
    })
    authIdentityIds = (identities ?? []).map((i: any) => i.id)
  } catch {
    // If the filtered lookup isn't supported, fall back to scanning all.
    try {
      const all = await authService.listAuthIdentities({}, { take: 1000 })
      authIdentityIds = (all ?? [])
        .filter((i: any) => i?.app_metadata?.user_id === targetId)
        .map((i: any) => i.id)
    } catch {
      // best-effort
    }
  }

  await removeUserAccountWorkflow(req.scope).run({ input: { userId: targetId } })

  // Delete the credential so the removed user can no longer authenticate.
  if (authIdentityIds.length) {
    try {
      await authService.deleteAuthIdentities(authIdentityIds)
    } catch {
      // best-effort — the user is already deleted/unlinked
    }
  }

  res.status(200).json({ id: targetId, object: "user", deleted: true })
}
