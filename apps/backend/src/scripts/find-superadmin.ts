import { Modules } from "@medusajs/framework/utils"

export default async function findSuperAdmin({ container }: any) {
  const logger = container.resolve("logger")
  const userModule: any = container.resolve(Modules.USER)
  const authService: any = container.resolve(Modules.AUTH)

  const emails = ["admin@mautomate.ai", "ops@mautomate.ai", "easital@gmail.com", "test-superadmin@mautomate.ai"]
  for (const email of emails) {
    const users = await userModule.listUsers({ email }, { take: 1 }).catch(() => [])
    const identities = await authService.listAuthIdentities({}).catch(() => [])
    const id = identities.find((i: any) => i.app_metadata?.user_id === users?.[0]?.id)
    logger.info(email + " -> user=" + (users?.[0]?.id || "-") + " identity=" + (id?.id || "-"))
  }
}
