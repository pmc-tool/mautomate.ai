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
  //
  // This used to go through query.graph with a `sales_channels: { id }` filter.
  // Whatever that resolved to, it did not match — a store with two live products
  // was told to "Add products", and the whole checklist read 3-of-4 forever. The
  // link table is the fact of the matter: read it directly.
  let hasProducts = false
  try {
    if (scId) {
      const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const rows = await pg
        .select("psc.product_id")
        .from("product_sales_channel as psc")
        .join("product as p", "p.id", "psc.product_id")
        .where("psc.sales_channel_id", scId)
        .whereNull("p.deleted_at")
        .limit(1)
      hasProducts = Array.isArray(rows) && rows.length > 0
    }
  } catch {
    hasProducts = false
  }

  // shipping — and this must mean "a shopper can actually pick a delivery method",
  // not "a shipping option exists somewhere".
  //
  // The old check passed as soon as ANY non-return option existed anywhere in the
  // store. A merchant created one Standard Delivery for a Bangladesh zone, the
  // checklist went green — and every checkout on the storefront (which serves /us)
  // showed NO shipping method at all, so "Continue to payment" was dead and the
  // dashboard said nothing was left to do. A green tick over a store that cannot
  // take an order is worse than a red one.
  //
  // So: collect the countries actually covered by live, store-enabled, non-return
  // options, and require the store's own storefront country to be among them.
  let hasShipping = false
  let shippingCountries: string[] = []
  const storeCountry = String(
    (ctx.tenant.meta as any)?.default_country ||
      process.env.NEXT_PUBLIC_DEFAULT_REGION ||
      "us"
  ).toLowerCase()

  try {
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await pg
      .select("gz.country_code")
      .from("shipping_option as so")
      .join("service_zone as sz", "sz.id", "so.service_zone_id")
      .join("geo_zone as gz", "gz.service_zone_id", "sz.id")
      .leftJoin("shipping_option_rule as sor", function (this: any) {
        this.on("sor.shipping_option_id", "=", "so.id")
          .andOn("sor.attribute", "=", pg.raw("?", ["is_return"]))
          .andOnNull("sor.deleted_at")
      })
      .whereNull("so.deleted_at")
      .whereNull("sz.deleted_at")
      .whereNull("gz.deleted_at")
      // A return option is not a delivery option.
      .andWhere(function (this: any) {
        this.whereNull("sor.value").orWhereRaw("sor.value::text not like '%true%'")
      })

    shippingCountries = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .map((r: any) => String(r.country_code || "").toLowerCase())
          .filter(Boolean)
      )
    ).sort()

    hasShipping = shippingCountries.includes(storeCountry)
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

  // custom domain — CONNECTED, not merely typed in.
  //
  // The old check was `type !== "free"`, so a domain that had been ADDED but
  // never verified ticked the box. A store showed "Connect your domain ✅" while
  // its custom domain sat at verification_status = pending and ssl_status =
  // pending — i.e. it did not resolve, served no traffic, and the owner had done
  // none of the DNS work. A checklist that congratulates you for unfinished work
  // is worse than one that nags.
  let hasDomain = false
  let pendingDomain: string | null = null
  try {
    const domains = await ctx.svc
      .listTenantDomains({ tenant_id: tenantId })
      .catch(() => [])
    const custom = (domains || []).filter((d: any) => d.type !== "free")
    hasDomain = custom.some(
      (d: any) => String(d.verification_status ?? "") === "verified"
    )
    if (!hasDomain) {
      pendingDomain = custom[0]?.domain ?? null
    }
  } catch {
    hasDomain = false
  }

  res.json({
    products: hasProducts,
    shipping: hasShipping,
    payment: hasPayment,
    domain: hasDomain,
    // Context for the checklist: which countries CAN be delivered to today, and
    // which one the storefront actually sells in. When these disagree the store
    // looks finished and cannot take a single order.
    shipping_countries: shippingCountries,
    store_country: storeCountry,
    // A custom domain that was added but never verified. The checklist can then
    // say "finish connecting sdas.cn" instead of pretending it is done.
    pending_domain: pendingDomain,
  })
}
