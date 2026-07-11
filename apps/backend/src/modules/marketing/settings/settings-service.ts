import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"

/**
 * SettingsService — thin accessor over the durable `marketing_setting`
 * key/value store.
 *
 * This is the DURABLE RUNTIME KILL SWITCH layer — ops-level, flip-without-
 * redeploy controls. Most importantly `publishing_halted`, an emergency stop
 * that pauses all scheduled/social publishing while the feature stays deployed.
 *
 * Values are stored as json, so a setting can be a boolean, number, string or
 * object. `set` upserts against the partial-unique (tenant_id, key) index.
 * Reads are fail-safe: a resolution/lookup error returns the fallback rather
 * than throwing.
 */
export const PUBLISHING_HALTED_KEY = "publishing_halted"

export class SettingsService {
  private readonly container_: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container_ = container
  }

  private mk(): any {
    return this.container_.resolve(MARKETING_MODULE)
  }

  /**
   * Read a setting's value for a tenant. Returns `fallback` when no live row
   * exists for the key, or when the lookup fails (fail-safe).
   */
  async get<T = unknown>(
    tenantId: string,
    key: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      const mk = this.mk()
      const rows = await mk.listMarketingSettings(
        { tenant_id: tenantId, key },
        { take: 1 }
      )
      const row = rows?.[0]
      if (!row) {
        return fallback
      }
      return row.value as T
    } catch {
      return fallback
    }
  }

  /**
   * Upsert a setting's value for a tenant. Creates the row when absent,
   * otherwise updates the existing live row (partial-unique (tenant_id, key)).
   */
  async set(tenantId: string, key: string, value: unknown): Promise<void> {
    const mk = this.mk()
    const rows = await mk.listMarketingSettings(
      { tenant_id: tenantId, key },
      { take: 1 }
    )
    const existing = rows?.[0]
    if (existing) {
      await mk.updateMarketingSettings({ id: existing.id, value })
      return
    }
    await mk.createMarketingSettings({ tenant_id: tenantId, key, value })
  }

  /**
   * Durable publishing kill switch — is scheduled/social publishing halted for
   * this tenant? Defaults to `false` (not halted) when the flag is unset.
   */
  async isPublishingHalted(tenantId: string): Promise<boolean> {
    const value = await this.get<boolean>(
      tenantId,
      PUBLISHING_HALTED_KEY,
      false
    )
    return value === true
  }

  /** Flip the durable publishing kill switch for a tenant. */
  async setPublishingHalted(tenantId: string, halted: boolean): Promise<void> {
    await this.set(tenantId, PUBLISHING_HALTED_KEY, halted)
  }
}

export default SettingsService
