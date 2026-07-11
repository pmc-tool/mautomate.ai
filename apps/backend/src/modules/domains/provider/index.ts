/**
 * Registrar provider accessor. Returns the configured ResellerClub adapter, or
 * null when reseller creds are absent (domains subsystem dormant). Loaded lazily
 * so the adapter module can be authored independently.
 */
import type { RegistrarProvider } from "./types"
import { isResellerConfigured } from "./config"

let cached: RegistrarProvider | null = null

export const getRegistrarProvider = (): RegistrarProvider | null => {
  if (!isResellerConfigured()) {
    return null
  }
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./resellerclub")
    cached = new mod.ResellerClubProvider() as RegistrarProvider
  }
  return cached
}

export * from "./types"
export { isResellerConfigured, getResellerConfig, DOMAINS_DEFAULT_TENANT } from "./config"
