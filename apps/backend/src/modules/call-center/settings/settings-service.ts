import type { MedusaContainer } from "@medusajs/framework/types"

import { CALL_CENTER_MODULE } from "../index"

/**
 * SettingsService — thin accessor over the durable `call_center_setting`
 * key/value store.
 *
 * This is the DURABLE RUNTIME KILL SWITCH layer. The env `CALL_CENTER_ENABLED`
 * stays the master compile-time gate (feature is only scheduled/compiled when
 * it is "true"); the settings here are the ops-level, flip-without-redeploy
 * controls — most importantly `outbound_halted`, an emergency stop that pauses
 * all outbound dialing/enrollment while the feature remains deployed.
 *
 * Values are stored as json, so a setting can be a boolean, number, string or
 * object. `set` upserts against the partial-unique (tenant_id, key) index.
 */
export const OUTBOUND_HALTED_KEY = "outbound_halted"

export class SettingsService {
  private readonly container_: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container_ = container
  }

  private cc(): any {
    return this.container_.resolve(CALL_CENTER_MODULE)
  }

  /**
   * Read a setting's value for a tenant. Returns `fallback` when no live row
   * exists for the key.
   */
  async get<T = unknown>(
    tenantId: string,
    key: string,
    fallback?: T
  ): Promise<T | undefined> {
    const cc = this.cc()
    const rows = await cc.listCallCenterSettings(
      { tenant_id: tenantId, key },
      { take: 1 }
    )
    const row = rows?.[0]
    if (!row) {
      return fallback
    }
    return row.value as T
  }

  /**
   * Upsert a setting's value for a tenant. Creates the row when absent,
   * otherwise updates the existing live row (partial-unique (tenant_id, key)).
   */
  async set(tenantId: string, key: string, value: unknown): Promise<void> {
    const cc = this.cc()
    const rows = await cc.listCallCenterSettings(
      { tenant_id: tenantId, key },
      { take: 1 }
    )
    const existing = rows?.[0]
    if (existing) {
      await cc.updateCallCenterSettings({ id: existing.id, value })
      return
    }
    await cc.createCallCenterSettings({ tenant_id: tenantId, key, value })
  }

  /**
   * Durable outbound kill switch — is outbound dialing/enrollment halted for
   * this tenant? Defaults to `false` (not halted) when the flag is unset.
   */
  async isOutboundHalted(tenantId: string): Promise<boolean> {
    const value = await this.get<boolean>(tenantId, OUTBOUND_HALTED_KEY, false)
    return value === true
  }

  /** Flip the durable outbound kill switch for a tenant. */
  async setOutboundHalted(tenantId: string, halted: boolean): Promise<void> {
    await this.set(tenantId, OUTBOUND_HALTED_KEY, halted)
  }
}

export default SettingsService
