import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Ensure a tenant's dedicated region carries the countries it sells to.
 *
 * Tenant regions are created country-less (per-tenant currency needs a per-tenant
 * region, and a country belongs to exactly ONE region in Medusa). But CHECKOUT
 * requires the shipping-address country to be within the cart's region — a
 * country-less region rejects every address ("Country with code X is not within
 * region"). So once a store knows where it delivers, we assign those countries
 * to its own region.
 *
 * Multi-tenant-safe: a country already held by ANOTHER store's region is left
 * alone (never stolen) — that country simply won't be checkout-able for this
 * store until the platform isolates overlapping-country tenants. Best-effort and
 * non-throwing.
 *
 * Returns the region's country list after the update (lowercase iso_2).
 */
export async function ensureRegionCountries(
  scope: any,
  regionId: string | undefined | null,
  countries: string[]
): Promise<string[]> {
  const want = (countries || [])
    .map((c) => String(c || "").toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c))
  if (!regionId || !want.length) return []

  try {
    const regionModule: any = scope.resolve(Modules.REGION)
    const region = await regionModule
      .retrieveRegion(regionId, { relations: ["countries"] })
      .catch(() => null)
    if (!region) return []

    const existing = new Set(
      (region.countries || [])
        .map((c: any) => String(c.iso_2 || "").toLowerCase())
        .filter(Boolean)
    )

    // Never steal a country from another store's region.
    const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const claimed = await pg
      .select("iso_2", "region_id")
      .from("region_country")
      .whereIn("iso_2", want)
      .catch(() => [])
    const takenByOthers = new Set(
      (claimed || [])
        .filter((r: any) => r.region_id && r.region_id !== regionId)
        .map((r: any) => String(r.iso_2 || "").toLowerCase())
    )

    const merged = Array.from(
      new Set([...existing, ...want.filter((c) => !takenByOthers.has(c))])
    )
    if (merged.length === existing.size) {
      return Array.from(existing)
    }

    await regionModule.updateRegions(regionId, { countries: merged })
    return merged
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[region] country assignment failed (non-blocking):", e?.message ?? e)
    return []
  }
}
