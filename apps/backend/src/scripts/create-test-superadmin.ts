import { Modules } from "@medusajs/framework/utils"

export default async function createTestSuperAdmin({ container }: any) {
  const logger = container.resolve("logger")
  const userModule: any = container.resolve(Modules.USER)
  const authService: any = container.resolve(Modules.AUTH)

  const email = process.env.TEST_SUPERADMIN_EMAIL ?? "test-superadmin@mautomate.ai"
  const password = process.env.TEST_SUPERADMIN_PASSWORD ?? "TestSuperadmin123!"

  const existing = await userModule.listUsers({ email }, { take: 1 }).catch(() => [])
  if (existing?.length) {
    logger.info("Superadmin user " + email + " already exists")
    return { success: true, userId: existing[0].id, email, existed: true }
  }

  try {
    const user = await userModule.createUsers({ email })
    const { authIdentity, error } = await authService.register("emailpass", { body: { email, password } })
    if (error || !authIdentity) {
      await userModule.deleteUsers([user.id]).catch(() => {})
      throw new Error(typeof error === "string" ? error : "could not set password")
    }
    logger.info("Created test superadmin " + email + " (" + user.id + ")")
    return { success: true, userId: user.id, email, existed: false }
  } catch (e: any) {
    logger.error("Failed: " + (e?.message || e))
    return { success: false, error: e?.message || String(e) }
  }
}
