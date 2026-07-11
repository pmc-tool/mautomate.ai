import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import type CmsModuleService from "../../../../modules/cms/service"
import { DEFAULT_CMS_ROLE, isCmsRole } from "../../../../modules/cms/role-helper"
import { assertAdminActor, listAllUsers, type RoleListEntry } from "./_helpers"

/**
 * GET /admin/cms/roles
 *
 * Admin only (also enforced by the `/admin/cms/roles*` matcher in middlewares).
 * Lists every core admin user joined with their EFFECTIVE CMS role. Users with
 * no explicit cms_user_role row appear with role "admin" + `is_default:true`
 * (the fail-safe), so the UI shows the true effective permission for everyone.
 *
 * If the core User module can't be reached, falls back to returning just the raw
 * role rows (user_id + role) so the UI can resolve names from GET /admin/users.
 *
 * Response: { roles: RoleListEntry[], count, default_role }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  assertAdminActor(req)

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const roleRows: Array<{ user_id: string; role: string }> =
    (await service.listCmsUserRoles({})) ?? []
  const roleByUser = new Map(roleRows.map((r) => [r.user_id, r.role]))

  const users = await listAllUsers(req)

  if (!users.length) {
    // Fallback: no user list — return raw rows, let the UI resolve names.
    const roles: RoleListEntry[] = roleRows.map((r) => ({
      user_id: r.user_id,
      email: null,
      first_name: null,
      last_name: null,
      role: isCmsRole(r.role) ? r.role : DEFAULT_CMS_ROLE,
      is_default: false,
    }))
    res.json({ roles, count: roles.length, default_role: DEFAULT_CMS_ROLE })
    return
  }

  const roles: RoleListEntry[] = users.map((u) => {
    const explicit = roleByUser.get(u.id)
    return {
      user_id: u.id,
      email: u.email ?? null,
      first_name: u.first_name ?? null,
      last_name: u.last_name ?? null,
      role: isCmsRole(explicit) ? explicit : DEFAULT_CMS_ROLE,
      is_default: !isCmsRole(explicit),
    }
  })

  res.json({ roles, count: roles.length, default_role: DEFAULT_CMS_ROLE })
}
