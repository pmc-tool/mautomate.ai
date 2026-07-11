import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import {
  GatewayDef,
  gatewayById,
  gatewaysForCountry,
  requiredCredentialKeys,
  vaultKey,
} from "../../../../modules/payments/registry"

const CONFIG_KEY = (id: string) => `gateway.${id}.config`

function normalizeRegions(gateway: GatewayDef, regions?: unknown): string[] {
  const raw = Array.isArray(regions) ? regions : []
  const codes = raw
    .map((r) => String(r).toUpperCase().trim())
    .filter((r) => gateway.countries.includes("*") || gateway.countries.includes(r))
  if (gateway.countries.includes("*") && codes.length === 0) {
    return ["*"]
  }
  if (!gateway.countries.includes("*") && codes.length === 0) {
    return gateway.countries.slice()
  }
  return codes
}

async function viewGateway(
  cfg: EncryptedConfigService,
  tenantId: string,
  gateway: GatewayDef
): Promise<Record<string, unknown>> {
  const config = await cfg.getConfig<{ enabled?: boolean; enabled_regions?: string[] }>(
    tenantId,
    CONFIG_KEY(gateway.id),
    { enabled: gateway.id === "bank_transfer", enabled_regions: gateway.countries.slice() }
  )

  const credentials = await Promise.all(
    gateway.credentials.map(async (cred) => {
      const key = vaultKey(gateway.id, cred.key)
      if (cred.secret) {
        const value = await cfg.getSecret(tenantId, key)
        return { ...cred, is_set: !!value }
      }
      const value = await cfg.getConfig<string>(tenantId, key, "")
      return { ...cred, value: value ?? "" }
    })
  )

  const required = requiredCredentialKeys(gateway)
  const configured = await (async () => {
    for (const key of required) {
      const cred = gateway.credentials.find((c) => c.key === key)
      if (!cred) return false
      const k = vaultKey(gateway.id, key)
      const value = cred.secret
        ? await cfg.getSecret(tenantId, k)
        : await cfg.getConfig<string>(tenantId, k, "")
      if (!value || !String(value).trim()) return false
    }
    return true
  })()

  return {
    id: gateway.id,
    provider_id: gateway.provider_id,
    name: gateway.name,
    blurb: gateway.blurb,
    countries: gateway.countries,
    mode: gateway.mode,
    logo: gateway.logo,
    docs_url: gateway.docs_url,
    setup_guide: gateway.setup_guide,
    configured,
    enabled: config?.enabled ?? false,
    enabled_regions: config?.enabled_regions ?? gateway.countries.slice(),
    credentials,
  }
}

/** GET /merchant/payments/gateways */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const cfg = new EncryptedConfigService(req.scope)
  const country = ctx.tenant.billing_country || "*"
  const gateways = gatewaysForCountry(country)

  const out = await Promise.all(
    gateways.map((g) => viewGateway(cfg, ctx.tenant.id, g))
  )

  res.json({
    tenant_country: ctx.tenant.billing_country || null,
    gateways: out,
  })
}

/** POST /merchant/payments/gateways */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const gatewayId = String(body.gateway_id ?? "").trim()
  const gateway = gatewayById(gatewayId)
  if (!gateway) {
    return res.status(400).json({ message: "unknown gateway" })
  }

  const cfg = new EncryptedConfigService(req.scope)
  const regions = normalizeRegions(gateway, body.enabled_regions)

  await cfg.setConfig(ctx.tenant.id, CONFIG_KEY(gateway.id), {
    enabled: body.enabled === true,
    enabled_regions: regions,
  })

  const provided = body.credentials ?? {}
  for (const cred of gateway.credentials) {
    const key = vaultKey(gateway.id, cred.key)
    const value = provided[cred.key]

    if (cred.secret) {
      if (typeof value === "string" && value.trim() && value !== "••••••••") {
        await cfg.setSecret(ctx.tenant.id, key, value.trim())
      } else if (value === null) {
        await cfg.deleteKey(ctx.tenant.id, key)
      }
    } else {
      if (value === null) {
        await cfg.deleteKey(ctx.tenant.id, key)
      } else if (typeof value === "string") {
        await cfg.setConfig(ctx.tenant.id, key, value.trim())
      }
    }
  }

  const updated = await viewGateway(cfg, ctx.tenant.id, gateway)
  res.status(200).json(updated)
}
