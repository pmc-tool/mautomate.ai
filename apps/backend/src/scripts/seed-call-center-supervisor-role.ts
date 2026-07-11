import { Modules } from "@medusajs/framework/utils"
import { resolveTenantId } from "../lib/tenant-context"
import { CALL_CENTER_MODULE } from "../modules/call-center"

/**
 * Idempotently grant the call-center "supervisor" role to the store's admin
 * users so they can open the Call Center section (which is FAIL-CLOSED behind
 * `requireCallCenterAccess`). Telephony/agent execution stays inert until the
 * relevant flags are set — this only unlocks the RBAC-gated admin UI/API.
 *
 * Users are looked up from Modules.USER (never hardcoded). By default every
 * admin user is granted supervisor; pass an optional email to target one user:
 *
 *   npx medusa exec ./src/scripts/seed-call-center-supervisor-role.ts
 *   npx medusa exec ./src/scripts/seed-call-center-supervisor-role.ts owner@store.com
 */
const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

export default async function seedCallCenterSupervisorRole({
  container,
  args,
}: any) {
  const cc: any = container.resolve(CALL_CENTER_MODULE)
  const userModule: any = container.resolve(Modules.USER)
  const logger = container.resolve("logger")

  const email = Array.isArray(args) ? args[0]?.trim() : undefined

  const users = email
    ? await userModule.listUsers({ email })
    : await userModule.listUsers({}, { take: 1000 })

  if (!Array.isArray(users) || !users.length) {
    logger.info(
      email
        ? `no admin user found for email ${email} — nothing to grant`
        : "no admin users found — nothing to grant"
    )
    return
  }

  for (const user of users) {
    const userId = user.id
    const existing = await cc.listAgentRoles({
      tenant_id: TENANT_ID,
      user_id: userId,
    })
    if (Array.isArray(existing) ? existing.length : existing) {
      logger.info(
        `call-center role already present for ${userId} — skipping`
      )
      continue
    }
    await cc.createAgentRoles({
      tenant_id: TENANT_ID,
      user_id: userId,
      role: "supervisor",
    })
    logger.info(`granted call-center supervisor role to ${userId}`)
  }

  logger.info("seed-call-center-supervisor-role complete")
}
