import { Modules } from "@medusajs/framework/utils"

export default async function listAuthIdentities({ container }: any) {
  const logger = container.resolve("logger")
  const authService: any = container.resolve(Modules.AUTH)

  const identities = await authService.listAuthIdentities({}).catch((e: any) => {
    logger.error("list error: " + (e?.message || e))
    return []
  })

  logger.info("Found " + identities.length + " identities")
  for (const id of identities.slice(0, 10)) {
    logger.info("id=" + id.id + " provider=" + id.provider + " identifier=" + id.identifier + " actor_id=" + (id.app_metadata?.user_id || id.app_metadata?.merchant_id || "-"))
  }
  return { count: identities.length }
}
