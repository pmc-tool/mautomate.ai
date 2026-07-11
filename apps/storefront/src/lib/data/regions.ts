"use server"

import {
  sdk,
  resolveTenantBackend,
  resolveTenantRegionId,
} from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
}

// MULTI-TENANT: this pooled storefront process serves EVERY store, so the region
// cache MUST be scoped per tenant — otherwise the first store to load poisons the
// "us" key and every other store reuses its region id ("Region ... not found").
// Key = "<tenant-backend>:<countryCode>"; dedicated stores each get their own
// backend url, pooled stores share the default backend (same regions → correct).
const regionMap = new Map<string, HttpTypes.StoreRegion>()

// MULTI-TENANT: the region-by-id cache is kept separate from the country-code
// map above and given a SHORT ttl, because a merchant can change their store's
// currency at any time (which re-points their region_id, or mutates that
// region's currency_code). The country-code map is fine to keep for the process
// lifetime — the set of regions/countries is stable — but the tenant's ACTIVE
// currency must be allowed to refresh. TTL bounds the reflect latency; the
// region_id is part of the key so re-pointing to a NEW region busts instantly.
const tenantRegionCache = new Map<
  string,
  { region: HttpTypes.StoreRegion; at: number }
>()
const TENANT_REGION_TTL_MS = 30 * 1000

export const getRegion = async (countryCode: string) => {
  const tenant = (await resolveTenantBackend()) ?? "default"

  // MULTI-TENANT: prefer the tenant's OWN region (it carries the tenant's
  // currency). In a pooled backend /store/regions returns every tenant's region,
  // so a country-code lookup can return another tenant's region (wrong currency).
  // Resolving region_id directly guarantees the tenant's currency, and the
  // short-ttl cache lets a currency change reflect within ~TENANT_REGION_TTL_MS.
  if (MULTI_TENANT) {
    const regionId = await resolveTenantRegionId()
    if (regionId) {
      const rkey = `${tenant}:rid:${regionId}`
      const hit = tenantRegionCache.get(rkey)
      if (hit && Date.now() - hit.at < TENANT_REGION_TTL_MS) {
        return hit.region
      }
      try {
        const region = await retrieveRegion(regionId)
        if (region) {
          tenantRegionCache.set(rkey, { region, at: Date.now() })
          return region
        }
      } catch {
        // region_id no longer resolves (deleted/renamed) — fall through to the
        // country-code lookup below rather than erroring the whole page.
      }
    }
  }

  const key = (cc: string) => `${tenant}:${cc}`

  if (regionMap.has(key(countryCode))) {
    return regionMap.get(key(countryCode))
  }

  const regions = await listRegions()

  if (!regions) {
    return null
  }

  regions.forEach((region) => {
    region.countries?.forEach((c) => {
      regionMap.set(key(c?.iso_2 ?? ""), region)
    })
  })

  return countryCode ? regionMap.get(key(countryCode)) : regionMap.get(key("us"))
}
