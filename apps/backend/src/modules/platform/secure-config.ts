import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "./index"
import {
  generateDataKey,
  openWithKey,
  sealWithKey,
  unwrapDataKey,
  wrapDataKey,
} from "../../lib/crypto"

/**
 * EncryptedConfigService — the per-tenant config + secret store.
 *
 * Envelope encryption end to end:
 *   1. Each tenant gets a random DEK, stored KEK-wrapped in `tenant_key`.
 *   2. Secrets are sealed with that DEK and written to `tenant_config`.
 * The raw DEK is only ever held in memory for the duration of a call; the KEK
 * lives outside the DB (PLATFORM_KEK env / KMS). Nothing is ever persisted in
 * plaintext, and every secret path THROWS rather than falling back.
 *
 * Mirrors the container-resolving accessor pattern of the module Settings
 * services, but replaces raw-JSON persistence with real encryption.
 */
export class EncryptedConfigService {
  private readonly container_: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container_ = container
  }

  private svc(): any {
    return this.container_.resolve(PLATFORM_MODULE)
  }

  /** Resolve (creating if needed) the tenant's raw DEK. In-memory only. */
  private async dek(tenantId: string): Promise<Buffer> {
    const svc = this.svc()
    const existing = await svc.listTenantKeys(
      { tenant_id: tenantId, active: true },
      { take: 1 }
    )
    const row = existing?.[0]
    if (row) {
      return unwrapDataKey(row.wrapped_dek)
    }
    const fresh = generateDataKey()
    await svc.createTenantKeys({
      tenant_id: tenantId,
      wrapped_dek: wrapDataKey(fresh),
      key_version: 1,
      active: true,
    })
    return fresh
  }

  /** Ensure a tenant has an active DEK (called once at provision time). */
  async ensureKey(tenantId: string): Promise<void> {
    await this.dek(tenantId)
  }

  private async upsert(
    tenantId: string,
    key: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const svc = this.svc()
    const rows = await svc.listTenantConfigs(
      { tenant_id: tenantId, key },
      { take: 1 }
    )
    const existing = rows?.[0]
    if (existing) {
      await svc.updateTenantConfigs({ id: existing.id, ...patch })
      return
    }
    await svc.createTenantConfigs({ tenant_id: tenantId, key, ...patch })
  }

  /** Store an encrypted secret (Stripe/AI/SMTP/telephony key, etc.). */
  async setSecret(tenantId: string, key: string, plain: string): Promise<void> {
    const dek = await this.dek(tenantId)
    await this.upsert(tenantId, key, {
      is_secret: true,
      value_sealed: sealWithKey(dek, plain),
      value_plain: null,
    })
  }

  /** Read + decrypt a secret. Returns `undefined` when absent. Throws on a
   * key/crypto failure (never returns a broken value). */
  async getSecret(tenantId: string, key: string): Promise<string | undefined> {
    const svc = this.svc()
    const rows = await svc.listTenantConfigs(
      { tenant_id: tenantId, key },
      { take: 1 }
    )
    const row = rows?.[0]
    if (!row || !row.is_secret || !row.value_sealed) {
      return undefined
    }
    const dek = await this.dek(tenantId)
    return openWithKey(dek, row.value_sealed)
  }

  /** Delete a config/secret row entirely (clear a key). */
  async deleteKey(tenantId: string, key: string): Promise<void> {
    const svc = this.svc()
    const rows = await svc.listTenantConfigs({ tenant_id: tenantId, key }, { take: 1 })
    if (rows?.[0]) {
      await svc.deleteTenantConfigs([rows[0].id])
    }
  }

  /** Store non-secret config (brand, theme, tracking ids) as plain json. */
  async setConfig(
    tenantId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    await this.upsert(tenantId, key, {
      is_secret: false,
      value_plain: value,
      value_sealed: null,
    })
  }

  /** Read non-secret config. Returns `fallback` when absent (fail-safe). */
  async getConfig<T = unknown>(
    tenantId: string,
    key: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      const svc = this.svc()
      const rows = await svc.listTenantConfigs(
        { tenant_id: tenantId, key },
        { take: 1 }
      )
      const row = rows?.[0]
      if (!row || row.is_secret) {
        return fallback
      }
      return (row.value_plain as T) ?? fallback
    } catch {
      return fallback
    }
  }

  /**
   * List the tenant's config keys with secrets REDACTED — the shape safe for
   * super-admin views. Secret values are never returned here.
   */
  async listRedacted(
    tenantId: string
  ): Promise<Array<{ key: string; is_secret: boolean; value: unknown }>> {
    const svc = this.svc()
    const rows = await svc.listTenantConfigs({ tenant_id: tenantId })
    return (rows ?? []).map((r: any) => ({
      key: r.key,
      is_secret: r.is_secret,
      value: r.is_secret ? "••••••••" : r.value_plain,
    }))
  }
}

export default EncryptedConfigService
