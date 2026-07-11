import { PLATFORM_MODULE } from "../modules/platform"
import { bootstrapTenantStoreWorkflow } from "../workflows/platform/bootstrap-tenant-store"

/**
 * Provision a REAL demo tenant (Phase 2 proof) — creates a platform tenant row
 * then runs the real commerce bootstrap (sales channel + publishable key +
 * sample product). Idempotent on slug. Prints the publishable key so isolation
 * can be verified against the store API.
 *
 * Run: npx medusa exec ./src/scripts/provision-demo-tenant.ts
 */
export default async function provisionDemoTenant({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const slug = process.env.DEMO_TENANT_SLUG ?? "demo-store"

  let [tenant] = await svc.listTenants({ slug }, { take: 1 })
  if (!tenant) {
    ;[tenant] = await svc.createTenants([
      {
        slug,
        name: process.env.DEMO_TENANT_NAME ?? "Demo Store",
        package: "growth",
        status: "provisioning",
      },
    ])
    logger.info(`[demo] created tenant ${tenant.id} (${slug})`)
  } else {
    logger.info(`[demo] tenant ${tenant.id} already exists — re-bootstrapping`)
  }

  const { result } = await bootstrapTenantStoreWorkflow(container).run({
    input: { tenant },
  })

  // mark live now that a real store scope exists
  await svc.updateTenants({ id: result.id, status: "live", provisioned_at: new Date() })

  logger.info(
    `[demo] BOOTSTRAPPED tenant=${result.id} sales_channel=${result.sales_channel_id} product=${result.sample_product_id}`
  )
  logger.info(`[demo] PUBLISHABLE_KEY=${result.publishable_key}`)
}
