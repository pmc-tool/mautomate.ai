import { PLATFORM_MODULE } from "../modules/platform"
import { Modules } from "@medusajs/framework/utils"

/**
 * backfill-tenant-regions — give every LIVE tenant a dedicated, country-less,
 * metadata.tenant_id-tagged region and persist the currency contract onto
 * tenant.meta (region_id / currency_code / supported_currencies).
 *
 * Behaviour per tenant:
 *   - SKIP  if meta.region_id already points at a region tagged with this tenant.
 *   - ADOPT an existing metadata.tenant_id-tagged region (persist its id) instead
 *           of creating a duplicate.
 *   - CREATE a new country-less region (currency = meta.currency_code ?? "usd")
 *           tagged with the tenant id, then persist the contract.
 *
 * Idempotent. Never touches another tenant's region. Country-less by design:
 * a country belongs to exactly one region and pooled tenants would collide.
 *
 * Run: npx medusa exec ./src/scripts/backfill-tenant-regions.ts
 */
export default async function backfillTenantRegions({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const regionModule: any = container.resolve(Modules.REGION)

  const tenants: any[] = await svc.listTenants({ status: "live" }, { take: 1000 })
  logger.info(`[backfill-regions] ${tenants.length} live tenant(s)`)

  // pull all regions once so we can look up existing tenant-tagged ones
  const allRegions: any[] = await regionModule
    .listRegions({}, { take: 1000 })
    .catch(() => [])

  let created = 0
  let adopted = 0
  let skipped = 0

  for (const tenant of tenants) {
    const meta = tenant.meta ?? {}
    const currency = (meta.currency_code ?? "usd").toLowerCase()

    // 1. already correctly wired? verify the referenced region is tenant-owned
    if (meta.region_id) {
      const current = allRegions.find((r) => r.id === meta.region_id)
      if (current && current.metadata?.tenant_id === tenant.id) {
        skipped++
        logger.info(
          `[backfill-regions] SKIP tenant=${tenant.id} (${tenant.slug}) region=${meta.region_id}`
        )
        continue
      }
    }

    // 2. adopt an existing region already tagged with this tenant id
    const tagged = allRegions.find(
      (r) => r.metadata?.tenant_id === tenant.id
    )
    if (tagged) {
      const cur = (tagged.currency_code ?? currency).toLowerCase()
      const supported =
        Array.isArray(meta.supported_currencies) && meta.supported_currencies.length
          ? Array.from(new Set([cur, ...meta.supported_currencies.map((c: string) => c.toLowerCase())]))
          : [cur]
      await svc.updateTenants({
        id: tenant.id,
        meta: {
          ...meta,
          region_id: tagged.id,
          currency_code: cur,
          supported_currencies: supported,
        },
      })
      adopted++
      logger.info(
        `[backfill-regions] ADOPT tenant=${tenant.id} (${tenant.slug}) region=${tagged.id} currency=${cur}`
      )
      continue
    }

    // 3. create a fresh country-less tagged region
    const [region] = await regionModule.createRegions([
      {
        name: `${tenant.name}`,
        currency_code: currency,
        payment_providers: ["pp_system_default"],
        metadata: { tenant_id: tenant.id },
      },
    ])
    const supported =
      Array.isArray(meta.supported_currencies) && meta.supported_currencies.length
        ? Array.from(new Set([currency, ...meta.supported_currencies.map((c: string) => c.toLowerCase())]))
        : [currency]
    await svc.updateTenants({
      id: tenant.id,
      meta: {
        ...meta,
        region_id: region.id,
        currency_code: currency,
        supported_currencies: supported,
      },
    })
    created++
    logger.info(
      `[backfill-regions] CREATE tenant=${tenant.id} (${tenant.slug}) region=${region.id} currency=${currency}`
    )
  }

  logger.info(
    `[backfill-regions] DONE created=${created} adopted=${adopted} skipped=${skipped}`
  )
}
