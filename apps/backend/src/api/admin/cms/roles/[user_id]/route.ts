import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import type CmsModuleService from "../../../../../modules/cms/service"
import {
  assertCmsRole,
  DEFAULT_CMS_ROLE,
} from "../../../../../modules/cms/role-helper"
import { one } from "../../pages/_helpers"
import {
  assertAdminActor,
  assertNotLastAdmin,
  recordRoleAudit,
} from "../_helpers"

/** Find the explicit role row for a user (or null). */
async function findRoleRow(
  service: CmsModuleService,
  userId: string
): Promise<{ id: string; user_id: string; role: string } | null> {
  const rows = await service.listCmsUserRoles({ user_id: userId })
  return (rows?.[0] as any) ?? null
}

type PutBody = { role?: string }

/**
 * PUT /admin/cms/roles/:user_id
 *
 * Admin only. Upsert the CMS role for a user. Guards the last-admin invariant:
 * downgrading the LAST effective admin to editor/viewer is rejected (403) — this
 * also covers an admin trying to downgrade themselves when no other admin exists.
 *
 * Body: { role: "admin" | "editor" | "viewer" }
 * Response: { role: <cms_user_role row> }
 */
export const PUT = async (
  req: AuthenticatedMedusaRequest<PutBody>,
  res: MedusaResponse
) => {
  assertAdminActor(req)

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const userId = req.params.user_id
  const nextRole = assertCmsRole((req.body ?? {}).role)

  if (!userId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A `user_id` path param is required."
    )
  }

  // Last-admin invariant (no-op when promoting to admin).
  await assertNotLastAdmin(req, service, userId, nextRole)

  const existing = await findRoleRow(service, userId)
  const before = existing ? { role: existing.role } : { role: DEFAULT_CMS_ROLE }

  let saved: any
  if (existing) {
    saved = one(
      await service.updateCmsUserRoles({ id: existing.id, role: nextRole })
    )
  } else {
    saved = one(
      await service.createCmsUserRoles({ user_id: userId, role: nextRole })
    )
  }

  await recordRoleAudit(req, service, userId, {
    before,
    after: { role: nextRole },
  })

  res.json({ role: saved })
}

/**
 * DELETE /admin/cms/roles/:user_id
 *
 * Admin only. Resets a user to the default role by removing their explicit row.
 * Because the no-row default is "admin", a reset can only ADD an admin back — it
 * never reduces the admin count, so it cannot violate the last-admin invariant.
 *
 * Response: { user_id, object: "cms_role", role: "admin", reset: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  assertAdminActor(req)

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const userId = req.params.user_id

  const existing = await findRoleRow(service, userId)

  if (!existing) {
    // Already at the implicit default — nothing to remove.
    res.json({
      user_id: userId,
      object: "cms_role",
      role: DEFAULT_CMS_ROLE,
      reset: true,
    })
    return
  }

  await service.deleteCmsUserRoles(existing.id)

  await recordRoleAudit(req, service, userId, {
    before: { role: existing.role },
    after: { role: `${DEFAULT_CMS_ROLE} (default)` },
  })

  res.json({
    user_id: userId,
    object: "cms_role",
    role: DEFAULT_CMS_ROLE,
    reset: true,
  })
}
