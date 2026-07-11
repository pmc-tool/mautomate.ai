import { Modules } from "@medusajs/framework/utils"

export default async function linkSuperAdmin({ container }: any) {
  const logger = container.resolve("logger")
  const userModule: any = container.resolve(Modules.USER)
  const authService: any = container.resolve(Modules.AUTH)

  const email = process.env.TEST_SUPERADMIN_EMAIL ?? "test-superadmin@mautomate.ai"

  const users = await userModule.listUsers({ email }, { take: 1 }).catch(() => [])
  const user = users?.[0]
  if (!user) {
    logger.error("User not found: " + email)
    return { success: false, error: "user not found" }
  }

  const authIdentities = await authService.listAuthIdentities({ identifier: email }).catch(() => [])
  const identity = authIdentities?.[0]
  if (!identity) {
    logger.error("Auth identity not found: " + email)
    return { success: false, error: "auth identity not found" }
  }

  await authService.updateAuthIdentities({ id: identity.id, app_metadata: { user_id: user.id } })
  logger.info("Linked auth identity " + identity.id + " to user " + user.id)
  return { success: true, userId: user.id, identityId: identity.id }
}
