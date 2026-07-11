import { MedusaError } from "@medusajs/framework/utils"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { EncryptedConfigService } from "../../../../../modules/platform/secure-config"
import {
  gatewayById,
  requiredCredentialKeys,
  vaultKey,
} from "../../../../../modules/payments/registry"
import {
  buildGatewayStatus,
  enabledProviderIds,
  readRegions,
  scopeId,
  setProviderOnRegions,
  storeCountrySet,
} from "../_helpers"

const MASK = "••••••••"

type Body = {
  values?: Record<string, string>
  enabled?: boolean
}

/**
 * POST /admin/payments/gateways/:id
 *
 * Body: { values?: Record<field, string>, enabled?: boolean }
 *
 * - Saves each provided credential: secrets via the encrypted vault, non-secrets
 *   as plain config. Blank or masked ("••••••••") values are skipped, so a
 *   merchant can re-save without retyping existing secrets.
 * - enabled === true: validates all required credentials are present, then adds
 *   the gateway's provider id to every store region.
 * - enabled === false: removes the provider id from every store region.
 *
 * Returns the updated gateway status (same shape as one entry in GET).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const id = req.params.id
  const gateway = gatewayById(id)
  if (!gateway) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Unknown payment gateway "${id}"`
    )
  }

  const body = (req.body ?? {}) as Body
  const values = body.values ?? {}
  const cfg = new EncryptedConfigService(req.scope)
  const scope = scopeId()

  // 1. Persist provided credentials (skip blank / masked so existing secrets stay).
  for (const cred of gateway.credentials) {
    if (!(cred.key in values)) {
      continue
    }
    const raw = values[cred.key]
    const value = typeof raw === "string" ? raw.trim() : ""
    if (!value || value === MASK) {
      continue
    }
    if (cred.secret) {
      await cfg.setSecret(scope, vaultKey(gateway.id, cred.key), value)
    } else {
      await cfg.setConfig(scope, vaultKey(gateway.id, cred.key), value)
    }
  }

  // 2. Enable / disable on the store's regions.
  if (body.enabled === true) {
    // Validate every required credential is now present.
    const missing: string[] = []
    for (const key of requiredCredentialKeys(gateway)) {
      const cred = gateway.credentials.find((c) => c.key === key)!
      const vKey = vaultKey(gateway.id, key)
      let present = false
      if (cred.secret) {
        try {
          const v = await cfg.getSecret(scope, vKey)
          present = v !== undefined && v !== ""
        } catch {
          present = false
        }
      } else {
        const v = await cfg.getConfig<string>(scope, vKey)
        present = v !== undefined && v !== ""
      }
      if (!present) {
        missing.push(key)
      }
    }
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot enable ${gateway.name}: missing credential(s) ${missing.join(", ")}.`
      )
    }
    await setProviderOnRegions(req.scope, gateway.provider_id, true)
  } else if (body.enabled === false) {
    await setProviderOnRegions(req.scope, gateway.provider_id, false)
  }

  // 3. Return the fresh status.
  const regions = await readRegions(req.scope)
  const status = await buildGatewayStatus(
    cfg,
    gateway,
    enabledProviderIds(regions),
    storeCountrySet(regions)
  )

  res.json({ gateway: status })
}
