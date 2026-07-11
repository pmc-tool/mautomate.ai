import { MedusaError } from "@medusajs/framework/utils"

import { EncryptedConfigService } from "../../platform/secure-config"
import { openWithKey, unwrapDataKey } from "../../../lib/crypto"
import {
  resolveTenantId as resolveTenantIdFromContext,
} from "../../../lib/tenant-context"
import { gatewayById, requiredCredentialKeys, vaultKey } from "../registry"

/**
 * Runtime credential loading for BYO-credential payment providers.
 *
 * Every provider is registered in medusa-config.ts with EMPTY options, so the
 * shared backend boots even when no gateway is configured. The actual
 * credentials are read here, at method-call time, from the per-tenant encrypted
 * vault (modules/platform/secure-config.ts) — never from static module options.
 *
 * Tenant scoping: in the shared (pooled) backend the request-scoped tenant id
 * is resolved via AsyncLocalStorage first; this lets one Node process safely
 * serve many tenants without leaking credentials. In legacy instance-per-tenant
 * containers the tenant id still comes from process.env.TENANT_ID.
 */

/** Shared platform scope key (matches api/admin/platform/integrations). */
export const VAULT_SCOPE = "__platform__"

/**
 * The scope key used to store/read this instance's gateway credentials.
 * Falls back to the platform scope only when no tenant context is active.
 */
export const resolveTenantId = (): string => {
  const tenantId = resolveTenantIdFromContext()
  return tenantId === "default" ? VAULT_SCOPE : tenantId
}

/** A gateway's decrypted credential values, keyed by field. */
export type GatewayCredentials = Record<string, string | undefined>

/**
 * Read every credential field for a gateway from the vault. Best-effort: on any
 * infrastructure error it returns whatever it could read (never throws here, so
 * boot and unrelated payment flows are unaffected). Callers gate on presence.
 *
 * Primary path uses EncryptedConfigService (resolves the platform module from
 * the provider container). If the provider container cannot resolve the platform
 * module, it falls back to reading the tenant_config / tenant_key tables
 * directly over the shared pg connection — both paths share the same crypto, so
 * they decrypt identically.
 */
export const loadGatewayCredentials = async (
  container: Record<string, unknown>,
  gatewayId: string
): Promise<GatewayCredentials> => {
  const gateway = gatewayById(gatewayId)
  if (!gateway) {
    return {}
  }
  const tenantId = resolveTenantId()
  const out: GatewayCredentials = {}

  // Primary: the encrypted config service (resolves the platform module).
  try {
    const cfg = new EncryptedConfigService(container as any)
    for (const cred of gateway.credentials) {
      const key = vaultKey(gatewayId, cred.key)
      out[cred.key] = cred.secret
        ? await cfg.getSecret(tenantId, key)
        : await cfg.getConfig<string>(tenantId, key)
    }
    return out
  } catch {
    // fall through to the direct-connection path
  }

  // Fallback: read the vault tables directly over the shared pg connection.
  try {
    const knex: any =
      (container as any).__pg_connection__ ||
      (container as any).manager ||
      undefined
    if (!knex) {
      return out
    }
    const keyRow = await knex("tenant_key")
      .where({ tenant_id: tenantId, active: true })
      .whereNull("deleted_at")
      .first()
    const dek = keyRow?.wrapped_dek ? unwrapDataKey(keyRow.wrapped_dek) : undefined

    for (const cred of gateway.credentials) {
      const key = vaultKey(gatewayId, cred.key)
      const row = await knex("tenant_config")
        .where({ tenant_id: tenantId, key })
        .whereNull("deleted_at")
        .first()
      if (!row) {
        continue
      }
      if (cred.secret) {
        if (row.is_secret && row.value_sealed && dek) {
          out[cred.key] = openWithKey(dek, row.value_sealed)
        }
      } else {
        out[cred.key] =
          typeof row.value_plain === "string"
            ? row.value_plain
            : row.value_plain != null
              ? String(row.value_plain)
              : undefined
      }
    }
  } catch {
    // best-effort: return whatever we have
  }
  return out
}

/**
 * Load credentials and assert every REQUIRED field is present. Throws a clear
 * MedusaError (never crashes boot — this only runs inside a payment method).
 */
export const requireGatewayCredentials = async (
  container: Record<string, unknown>,
  gatewayId: string
): Promise<GatewayCredentials> => {
  const gateway = gatewayById(gatewayId)
  if (!gateway) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown payment gateway "${gatewayId}"`
    )
  }
  const creds = await loadGatewayCredentials(container, gatewayId)
  const missing = requiredCredentialKeys(gateway).filter(
    (k) => !creds[k] || !String(creds[k]).trim()
  )
  if (missing.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${gateway.name} is not configured for this store. Missing credential(s): ${missing.join(", ")}. Add them under Settings > Payments.`
    )
  }
  return creds
}
