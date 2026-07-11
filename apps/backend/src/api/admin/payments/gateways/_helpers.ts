import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/core-flows"

import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import {
  resolveTenantId,
} from "../../../../modules/payments/providers/vault-provider"
import {
  GatewayDef,
  gatewayServesCountry,
  vaultKey,
} from "../../../../modules/payments/registry"

const MASK = "••••••••"

/** The vault scope key this instance reads/writes credentials under. */
export const scopeId = (): string => resolveTenantId()

export type RegionInfo = { id: string; countries: string[]; provider_ids: string[] }

/**
 * Read every region with its ISO-2 countries and enabled payment provider ids.
 * Best-effort: returns [] on any query error so the routes never crash.
 */
export const readRegions = async (scope: any): Promise<RegionInfo[]> => {
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "region",
      fields: ["id", "countries.iso_2", "payment_providers.id"],
    })
    return (data ?? []).map((r: any) => ({
      id: r.id,
      countries: (r.countries ?? [])
        .map((c: any) => String(c?.iso_2 || "").toUpperCase())
        .filter(Boolean),
      provider_ids: (r.payment_providers ?? [])
        .map((p: any) => p?.id)
        .filter(Boolean),
    }))
  } catch {
    return []
  }
}

/** All ISO-2 country codes served by the store's regions. */
export const storeCountrySet = (regions: RegionInfo[]): Set<string> => {
  const set = new Set<string>()
  for (const r of regions) {
    for (const c of r.countries) {
      set.add(c)
    }
  }
  return set
}

/** The store's primary country (first region's first country) or "*". */
export const primaryStoreCountry = (regions: RegionInfo[]): string => {
  for (const r of regions) {
    if (r.countries.length) {
      return r.countries[0]
    }
  }
  return "*"
}

/** The set of provider ids enabled on ANY region. */
export const enabledProviderIds = (regions: RegionInfo[]): Set<string> => {
  const set = new Set<string>()
  for (const r of regions) {
    for (const p of r.provider_ids) {
      set.add(p)
    }
  }
  return set
}

/**
 * Build the status object for a single gateway: its registry def plus
 * `configured`, `enabled`, `available`, and per-field `values` (secrets shown
 * masked when set, "" when unset; non-secrets shown in plain).
 */
export const buildGatewayStatus = async (
  cfg: EncryptedConfigService,
  gateway: GatewayDef,
  enabled: Set<string>,
  countries: Set<string>
) => {
  const scope = scopeId()
  const values: Record<string, string> = {}
  let allRequiredPresent = true

  for (const cred of gateway.credentials) {
    const key = vaultKey(gateway.id, cred.key)
    let present = false
    if (cred.secret) {
      let stored: string | undefined
      try {
        stored = await cfg.getSecret(scope, key)
      } catch {
        stored = undefined
      }
      present = stored !== undefined && stored !== ""
      values[cred.key] = present ? MASK : ""
    } else {
      const stored = await cfg.getConfig<string>(scope, key)
      present = stored !== undefined && stored !== ""
      values[cred.key] = present ? String(stored) : ""
    }
    if (!cred.optional && !present) {
      allRequiredPresent = false
    }
  }

  const available =
    gateway.countries.includes("*") ||
    countries.size === 0 ||
    [...countries].some((c) => gatewayServesCountry(gateway, c))

  return {
    ...gateway,
    configured: gateway.credentials.length === 0 ? true : allRequiredPresent,
    enabled: enabled.has(gateway.provider_id),
    available,
    values,
  }
}

/**
 * Add or remove a payment provider id across EVERY store region. Reads each
 * region's current provider list, computes the new deduped list, and updates
 * the region via the core update-regions workflow (which sets the full list).
 * Ensures at least pp_system_default remains so a region is never left with no
 * payment provider. Best-effort per region.
 */
export const setProviderOnRegions = async (
  scope: any,
  providerId: string,
  enable: boolean
): Promise<void> => {
  const regions = await readRegions(scope)
  for (const region of regions) {
    const current = new Set(region.provider_ids)
    if (enable) {
      current.add(providerId)
    } else {
      current.delete(providerId)
    }
    if (current.size === 0) {
      current.add("pp_system_default")
    }
    const nextList = [...current]
    // Skip regions whose provider set is unchanged.
    const same =
      nextList.length === region.provider_ids.length &&
      nextList.every((p) => region.provider_ids.includes(p))
    if (same) {
      continue
    }
    try {
      await updateRegionsWorkflow(scope).run({
        input: {
          selector: { id: region.id },
          update: { payment_providers: nextList },
        },
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[payments] failed to update region ${region.id}:`, e)
    }
  }
}
