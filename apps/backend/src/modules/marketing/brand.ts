import type { MedusaContainer } from "@medusajs/framework/types"

import { SettingsService } from "./settings/settings-service"

/**
 * Per-tenant brand/store resolution — the single source of truth that replaces
 * the old hardcoded "Forever Finds" / "https://foreverfinds.shop" literals so
 * every provisioned merchant's marketing is scoped to THEIR store.
 *
 * Resolution order (self-serve first, so a merchant can change these from their
 * own admin without a redeploy):
 *   1. durable marketing_setting KV (`brand_name` / `store_url`)
 *   2. per-instance env injected at provision (MARKETING_BRAND_NAME /
 *      MARKETING_STORE_URL) — this is also where the live Forever Finds store's
 *      values live, so it does not regress
 *   3. generic fallback ("Our Store" / a neutral store URL)
 *
 * Reads are fail-safe (SettingsService.get swallows lookup errors), so a missing
 * table or transient error degrades to the env/generic layer rather than
 * throwing.
 */

export const BRAND_NAME_SETTING_KEY = "brand_name"
export const STORE_URL_SETTING_KEY = "store_url"
export const BRAND_ACCENT_SETTING_KEY = "brand_accent"

const DEFAULT_BRAND_NAME = "Our Store"
const DEFAULT_STORE_URL = "https://store.example.com"

const clean = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Resolve the tenant's brand name: durable -> env -> generic. */
export const resolveBrandName = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  const durable = await new SettingsService(container).get<string>(
    tenantId,
    BRAND_NAME_SETTING_KEY
  )
  return clean(durable) ?? clean(process.env.MARKETING_BRAND_NAME) ?? DEFAULT_BRAND_NAME
}

/** Resolve the tenant's storefront URL (no trailing slash): durable -> env -> generic. */
export const resolveStoreUrl = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  const durable = await new SettingsService(container).get<string>(
    tenantId,
    STORE_URL_SETTING_KEY
  )
  const url =
    clean(durable) ?? clean(process.env.MARKETING_STORE_URL) ?? DEFAULT_STORE_URL
  return url.replace(/\/+$/, "")
}

/** Resolve the tenant's brand accent colour (hex). Empty string when unset. */
export const resolveBrandAccent = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  const durable = await new SettingsService(container).get<string>(
    tenantId,
    BRAND_ACCENT_SETTING_KEY
  )
  return clean(durable) ?? clean(process.env.MARKETING_BRAND_ACCENT) ?? ""
}

/**
 * Resolve the default RFC5322 `from` for a tenant's marketing email — derived
 * from the resolved brand name + the store URL's domain (`Brand <no-reply@domain>`).
 * Used only as the LAST fallback in send-service (after an explicit `from` and
 * the SMTP_FROM env), so a merchant's own from-address always wins.
 */
export const resolveEmailFrom = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  const brand = await resolveBrandName(container, tenantId)
  const storeUrl = await resolveStoreUrl(container, tenantId)
  let domain = ""
  try {
    domain = new URL(storeUrl).hostname
  } catch {
    domain = ""
  }
  const address = domain ? `no-reply@${domain}` : "no-reply@localhost"
  return `${brand} <${address}>`
}
