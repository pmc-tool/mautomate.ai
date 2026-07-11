import type { MedusaContainer } from "@medusajs/framework/types"

import { EncryptedConfigService } from "../secure-config"

/**
 * Per-tenant config resolution with env fallback (Phase 5 wiring).
 *
 * Lets the marketing / call-center / domains modules migrate from single-`.env`
 * config to per-tenant secrets WITHOUT breaking the current single-tenant run:
 *   1. if the platform is enabled and a per-tenant secret exists → use it
 *   2. otherwise fall back to the module's existing env var
 * So Forever Finds keeps working on env today, and a real multi-tenant instance
 * transparently reads each merchant's own Stripe/AI/SMTP key.
 */
export const platformEnabled = (): boolean =>
  process.env.PLATFORM_ENABLED === "true"

export async function getTenantSecret(
  container: MedusaContainer,
  tenantId: string,
  key: string,
  envFallback?: string
): Promise<string | undefined> {
  if (platformEnabled()) {
    try {
      const cfg = new EncryptedConfigService(container)
      const v = await cfg.getSecret(tenantId, key)
      if (v !== undefined) return v
    } catch {
      /* fall through to env */
    }
  }
  return envFallback ? process.env[envFallback] : undefined
}

export async function getTenantConfig<T = unknown>(
  container: MedusaContainer,
  tenantId: string,
  key: string,
  fallback?: T
): Promise<T | undefined> {
  if (platformEnabled()) {
    try {
      const cfg = new EncryptedConfigService(container)
      const v = await cfg.getConfig<T>(tenantId, key)
      if (v !== undefined) return v
    } catch {
      /* fall through */
    }
  }
  return fallback
}
