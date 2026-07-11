import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ensureStarterCmsContent } from "../modules/cms/starter-pages"
import { PLATFORM_MODULE } from "../modules/platform"

/**
 * Backfill the per-tenant starter CMS content (pages + footer/header links) for
 * EVERY pooled tenant. In the pooled multi-tenant model each store owns its own
 * cms_page / cms_setting rows (scoped by tenant_id), so this iterates all
 * tenants and seeds each store's OWN starter pages + chrome.
 *
 * Run with:  npx medusa exec ./src/scripts/seed-starter-cms.ts
 *
 * Idempotent and non-destructive — see ensureStarterCmsContent. Re-running only
 * creates what is missing (per tenant) and repairs dead "#" chrome links.
 */
export default async function seedStarterCms({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const platform: any = container.resolve(PLATFORM_MODULE)

  const tenants = await platform.listTenants({}, { take: 1000 })
  logger.info(
    `[cms] Backfilling starter CMS content for ${tenants?.length ?? 0} tenant(s)...`
  )

  for (const tenant of tenants ?? []) {
    try {
      const summary = await ensureStarterCmsContent(container, tenant.id)
      logger.info(
        `[cms] starter CMS backfill for ${
          tenant.slug ?? tenant.id
        }: ${JSON.stringify(summary)}`
      )
    } catch (e) {
      logger.error(
        `[cms] starter CMS backfill FAILED for ${tenant.slug ?? tenant.id}: ${
          (e as Error).message
        }`
      )
    }
  }

  logger.info("[cms] Starter CMS backfill complete.")
}
