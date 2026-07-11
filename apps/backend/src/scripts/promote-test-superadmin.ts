import { Modules } from "@medusajs/framework/utils"

export default async function promoteTestSuperAdmin({ container }: any) {
  const logger = container.resolve("logger")
  const authService: any = container.resolve(Modules.AUTH)

  const identityId = process.env.TEST_SUPERADMIN_IDENTITY ?? "authid_01KWXG1TPXBZEF4960BCW7Z6GE"
  const targetUserId = process.env.TARGET_SUPERADMIN_USER ?? "user_01KWM6K4HYNBPZSXY57HXSQ37P"

  try {
    await authService.updateAuthIdentities({ id: identityId, app_metadata: { user_id: targetUserId } })
    logger.info("Linked identity " + identityId + " to superadmin user " + targetUserId)
    return { success: true, identityId, targetUserId }
  } catch (e: any) {
    logger.error("Failed: " + (e?.message || e))
    return { success: false, error: e?.message || String(e) }
  }
}
