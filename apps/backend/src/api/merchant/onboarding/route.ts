import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"
import {
  gatewaysForCountry,
  requiredCredentialKeys,
  vaultKey,
} from "../../../modules/payments/registry"

/**
 * GET /merchant/onboarding
 *
 * Returns the store's setup completion status so the dashboard can show a
 * guided "finish setting up your store" checklist. Every check is tenant-scoped
 * and fails to `false` (never blocks the dashboard).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const tenantId = ctx.tenant.id
  const scId = ctx.tenant.meta?.sales_channel_id

  // products (scoped by the tenant's sales channel)
  let hasProducts = false
  try {
    if (scId) {
      const { data } = await query.graph({
        entity: "product",
        filters: { sales_channels: { id: scId } } as any,
        fields: ["id"],
        pagination: { take: 1, skip: 0 } as any,
      })
      hasProducts = (data || []).length > 0
    }
  } catch {
    hasProducts = false
  }

  // shipping (the tenant's location has at least one non-return shipping option)
  let hasShipping = false
  try {
    const { data } = await query.graph({
      entity: "stock_location",
      filters: { metadata: { tenant_id: tenantId } } as any,
      fields: [
        "id",
        "fulfillment_sets.service_zones.shipping_options.id",
        "fulfillment_sets.service_zones.shipping_options.rules.attribute",
        "fulfillment_sets.service_zones.shipping_options.rules.value",
      ],
      pagination: { take: 5, skip: 0 } as any,
    })
    for (const loc of data || []) {
      for (const fs of loc.fulfillment_sets || []) {
        for (const z of fs.service_zones || []) {
          for (const o of z.shipping_options || []) {
            const isReturn = (o.rules || []).some(
              (r: any) => r.attribute === "is_return" && (r.value === "true" || r.value === true)
            )
            if (!isReturn) hasShipping = true
          }
        }
      }
    }
  } catch {
    hasShipping = false
  }

  // payment (at least one gateway enabled + fully configured)
  let hasPayment = false
  try {
    const cfg = new EncryptedConfigService(req.scope)
    const gateways = gatewaysForCountry((ctx.tenant.billing_country as string) || "*")
    for (const g of gateways) {
      const config = await cfg
        .getConfig<{ enabled?: boolean }>(tenantId, `gateway.${g.id}.config`, { enabled: false })
        .catch(() => null)
      if (!config?.enabled) continue
      let ready = true
      for (const key of requiredCredentialKeys(g)) {
        const cred = g.credentials.find((c: any) => c.key === key)
        if (!cred) { ready = false; break }
        const k = vaultKey(g.id, key)
        const v = cred.secret
          ? await cfg.getSecret(tenantId, k).catch(() => undefined)
          : await cfg.getConfig<string>(tenantId, k, "").catch(() => "")
        if (!v || !String(v).trim()) { ready = false; break }
      }
      if (ready) { hasPayment = true; break }
    }
  } catch {
    hasPayment = false
  }

  // custom domain (a non-free connected domain)
  let hasDomain = false
  try {
    const domains = await ctx.svc.listTenantDomains({ tenant_id: tenantId }).catch(() => [])
    hasDomain = (domains || []).some((d: any) => d.type !== "free")
  } catch {
    hasDomain = false
  }

  res.json({
    products: hasProducts,
    shipping: hasShipping,
    payment: hasPayment,
    domain: hasDomain,
  })
}
