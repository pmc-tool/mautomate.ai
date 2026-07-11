import { Modules } from "@medusajs/framework/utils"

export default async function linkSuperAdmin2({ container }: any) {
  const logger = container.resolve("logger")
  const userModule: any = container.resolve(Modules.USER)
  const authService: any = container.resolve(Modules.AUTH)

  const email = process.env.TEST_SUPERADMIN_EMAIL ?? "test-superadmin@mautomate.ai"
  const identityId = process.env.TEST_SUPERADMIN_IDENTITY ?? "authid_01KWXG1TPXBZEF4960BCW7Z6GE"

  const users = await userModule.listUsers({ email }, { take: 1 }).catch(() => [])
  const user = users?.[0]
  if (!user) {
    logger.error("User not found: " + email)
    return { success: false, error: "user not found" }
  }

  try {
    await authService.updateAuthIdentities({ id: identityId, app_metadata: { user_id: user.id } })
    logger.info("Linked identity " + identityId + " to user " + user.id)
    return { success: true, userId: user.id, identityId }
  } catch (e: any) {
    logger.error("Link failed: " + (e?.message || e))
    return { success: false, error: e?.message || String(e) }
  }
}
