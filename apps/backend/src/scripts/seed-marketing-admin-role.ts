import { Modules } from "@medusajs/framework/utils"

import { resolveTenantId } from "../lib/tenant-context"
import { MARKETING_MODULE } from "../modules/marketing"

/**
 * Idempotently grant the marketing "admin" role to EVERY admin user of this
 * instance's tenant so they can open the Marketing section. Publishing/
 * automations stay inert until MARKETING_ENABLED is set — this only unlocks the
 * RBAC-gated admin UI/API.
 *
 * Generalized (no hardcoded Forever Finds user ids): it resolves the User
 * module, lists admin users, and grants each of them the role for the current
 * tenant (resolveTenantId). Safe to re-run — existing grants are skipped.
 *
 * Run: npx medusa exec ./src/scripts/seed-marketing-admin-role.ts
 */
const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

export default async function seedMarketingAdminRole({ container }: any) {
  const svc: any = container.resolve(MARKETING_MODULE)
  const userService: any = container.resolve(Modules.USER)
  const logger = container.resolve("logger")

  const users = await userService.listUsers({}, { take: 1000 })
  if (!Array.isArray(users) || users.length === 0) {
    logger.info("no admin users found — nothing to grant")
    return
  }

  for (const user of users) {
    const userId = user?.id
    if (!userId) {
      continue
    }
    const existing = await svc.listMarketingAgentRoles({
      tenant_id: TENANT_ID,
      user_id: userId,
    })
    if (Array.isArray(existing) ? existing.length : existing) {
      logger.info(`marketing role already present for ${userId} — skipping`)
      continue
    }
    await svc.createMarketingAgentRoles({
      tenant_id: TENANT_ID,
      user_id: userId,
      role: "admin",
    })
    logger.info(`granted marketing admin role to ${userId}`)
  }

  logger.info("seed-marketing-admin-role complete")
}
