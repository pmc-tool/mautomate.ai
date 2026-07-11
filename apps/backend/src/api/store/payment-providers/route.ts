import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeTenant } from "../_tenant"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"
import {
  gatewaysForCountry,
  requiredCredentialKeys,
  vaultKey,
  GatewayDef,
} from "../../../modules/payments/registry"

const CONFIG_KEY = (id: string) => `gateway.${id}.config`

/**
 * GET /store/payment-providers  (OVERRIDES Medusa's native route)
 *
 * In this pooled multi-tenant model payment providers are NOT chosen by region
 * (all stores share one "Platform" region). Each seller configures their OWN
 * gateways (bKash/Stripe/etc.) with their own credentials via
 * /merchant/payments/gateways, stored per-tenant in the encrypted config vault.
 *
 * This route resolves the tenant from the storefront's publishable key and
 * returns ONLY that seller's gateways that are BOTH enabled AND fully
 * configured — so every store shows its own payment methods at checkout. Fails
 * closed (empty list) when the tenant can't be resolved.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenant = await storeTenant(req)
  if (!tenant) {
    return res.json({ payment_providers: [], count: 0 })
  }

  const cfg = new EncryptedConfigService(req.scope)
  const country = (tenant.meta?.billing_country as string) || "*"
  const gateways = gatewaysForCountry(country)

  async function isReady(gateway: GatewayDef): Promise<boolean> {
    const config = await cfg
      .getConfig<{ enabled?: boolean }>(tenant!.id, CONFIG_KEY(gateway.id), { enabled: false })
      .catch(() => null)
    if (!config?.enabled) return false
    // all required credentials present
    for (const key of requiredCredentialKeys(gateway)) {
      const cred = gateway.credentials.find((c) => c.key === key)
      if (!cred) return false
      const k = vaultKey(gateway.id, key)
      const value = cred.secret
        ? await cfg.getSecret(tenant!.id, k).catch(() => undefined)
        : await cfg.getConfig<string>(tenant!.id, k, "").catch(() => "")
      if (!value || !String(value).trim()) return false
    }
    return true
  }

  const ready = await Promise.all(
    gateways.map(async (g) => ((await isReady(g)) ? g : null))
  )

  const providers = ready
    .filter((g): g is GatewayDef => !!g)
    // de-dupe by provider_id (multiple gateways can map to pp_system_default)
    .reduce((acc: { id: string }[], g) => {
      if (!acc.some((p) => p.id === g.provider_id)) {
        acc.push({ id: g.provider_id })
      }
      return acc
    }, [])

  res.json({ payment_providers: providers, count: providers.length })
}
