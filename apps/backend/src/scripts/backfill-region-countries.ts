import { PLATFORM_MODULE } from "../modules/platform"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ensureRegionCountries } from "../api/merchant/_region"

/**
 * backfill-region-countries — put each store's selling country (and any country
 * it delivers to) onto its OWN region, so checkout stops rejecting addresses
 * ("Country with code X is not within region"). Multi-tenant-safe: a country
 * already claimed by another store's region is skipped (see ensureRegionCountries).
 *
 * Run: npx medusa exec ./src/scripts/backfill-region-countries.ts
 */
export default async function backfillRegionCountries({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const tenants: any[] = await svc.listTenants({}, { take: 5000 })
  let updated = 0

  for (const t of tenants) {
    const regionId = t.meta?.region_id
    if (!regionId) continue

    const countries = new Set<string>()
    if (t.meta?.default_country) {
      countries.add(String(t.meta.default_country).toLowerCase())
    }
    // countries this store delivers to (its own tenant-tagged locations)
    try {
      const rows = await pg
        .select("gz.country_code")
        .from("stock_location as sl")
        .join("location_fulfillment_set as lfs", "lfs.stock_location_id", "sl.id")
        .join("fulfillment_set as fs", "fs.id", "lfs.fulfillment_set_id")
        .join("service_zone as sz", "sz.fulfillment_set_id", "fs.id")
        .join("geo_zone as gz", "gz.service_zone_id", "sz.id")
        .whereRaw("sl.metadata->>'tenant_id' = ?", [t.id])
        .whereNull("gz.deleted_at")
      for (const r of rows || []) {
        if (r.country_code) countries.add(String(r.country_code).toLowerCase())
      }
    } catch {
      /* ignore */
    }

    if (!countries.size) continue
    const result = await ensureRegionCountries(container, regionId, Array.from(countries))
    if (result.length) updated++
  }

  logger.info(
    `[backfill-region-countries] assigned countries to ${updated} of ${tenants.length} tenant region(s)`
  )
}
