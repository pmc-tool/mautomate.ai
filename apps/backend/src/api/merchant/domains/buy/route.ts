import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant, domainEntitlement } from "../../_helpers"
import {
  buyDomain,
  mutateDnsRecord,
  searchDomains,
} from "../../../../modules/domains/domain-service"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import {
  getResellerConfig,
  isResellerConfigured,
} from "../../../../modules/domains/provider"
import { DomainRoutingService } from "../../../../modules/platform/domain-routing"
import { CloudflareSaaSClient } from "../../../../modules/platform/provider/cloudflare/client"
import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { applyMarkup } from "../_shared"

const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")
const MANUAL_APPROVAL_ENABLED =
  process.env.DOMAIN_MANUAL_APPROVAL_ENABLED !== "0"

function normalizeDomain(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
}

function splitDomain(domain: string): { sld: string; tld: string } {
  const idx = domain.lastIndexOf(".")
  if (idx === -1) return { sld: domain, tld: "" }
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) }
}

function isApexDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/\.$/, "")
  const labels = host.split(".")
  const twoPart = new Set(["co.uk", "com.bd", "com.au", "co.in", "com.br"])
  const suffix2 = labels.slice(-2).join(".")
  if (twoPart.has(suffix2)) return labels.length === 3
  return labels.length === 2
}

function relativeHost(domain: string, fullName: string): string {
  const suffix = `.${domain}`
  const name = fullName.trim().toLowerCase().replace(/\.$/, "")
  if (name === domain) return "@"
  if (name.endsWith(suffix)) return name.slice(0, -suffix.length)
  return name
}

async function addCloudflareDnsRecords(
  container: any,
  tenantId: string,
  domain: string,
  instructions: { kind: string; name: string; value: string }[]
) {
  for (const rec of instructions) {
    if (rec.kind === "cname") {
      await mutateDnsRecord(container, {
        tenantId,
        domainName: domain,
        op: "add",
        record: {
          type: "CNAME",
          host: isApexDomain(domain) ? "www" : "@",
          value: rec.value,
          ttl: 3600,
        },
      })
    } else if (rec.kind === "txt") {
      await mutateDnsRecord(container, {
        tenantId,
        domainName: domain,
        op: "add",
        record: {
          type: "TXT",
          host: relativeHost(domain, rec.name),
          value: rec.value,
          ttl: 3600,
        },
      })
    }
  }
}

/**
 * POST /merchant/domains/buy
 *
 * Domains are paid for with a CARD, never with AI credits: a domain is a real
 * registrar invoice, and credits are the AI currency. We create the order in
 * `awaiting_payment`, return a Stripe checkout url, and only register the domain
 * once the payment webhook confirms the money has actually arrived.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  // Gate BEFORE any registrar work so a trial can't buy a domain it
  // couldn't connect anyway.
  const ent = await domainEntitlement(ctx)
  if (!ent.ok) {
    return res.status(403).json({ message: ent.message, upgrade_required: true })
  }

  const body = (req.body ?? {}) as any
  const domainName = normalizeDomain(body.domain_name)
  const years = Math.min(Math.max(Number(body.years ?? 1), 1), 10)
  const privacy = !!body.privacy
  const autoRenew = !!body.auto_renew

  if (!domainName || !/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domainName)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. shop.example.com" })
  }

  const { tld } = splitDomain(domainName)
  if (!tld) {
    return res.status(400).json({ message: "domain must include a TLD" })
  }

  const configured = isResellerConfigured()
  let unitPriceUsd = 0

  if (configured) {
    const search = await searchDomains(req.scope, {
      tenantId: ctx.tenant.id,
      query: domainName,
      tlds: [tld],
    })
    if (!search.ok) {
      return res.status(502).json({ message: search.error ?? "availability lookup failed" })
    }
    const hit = (search.data?.results ?? []).find(
      (r: any) => `${r.domain}.${r.tld}` === domainName
    )
    if (!hit || !hit.available) {
      return res.status(400).json({ message: "domain is not available for registration" })
    }
    unitPriceUsd = hit.price?.register ?? 0
    if (!unitPriceUsd || unitPriceUsd <= 0) {
      return res.status(400).json({ message: "price unavailable for this domain" })
    }
  } else {
    unitPriceUsd = FALLBACK_PRICE_USD
  }

  const totalUsd = applyMarkup(unitPriceUsd) * years

  // A DOMAIN IS BOUGHT WITH REAL MONEY, NOT CREDITS.
  //
  // Credits are our AI currency — a domain is a registrar invoice we pass
  // through with a margin. Charging credits for it would let a merchant turn an
  // AI allowance into a real-world asset we have to pay cash for.
  //
  // So: create the order in `awaiting_payment`, hand back a card checkout, and
  // register the domain only when the payment webhook confirms the money is in.
  const domainsModule: any = req.scope.resolve(DOMAINS_MODULE)

  const [order] = await domainsModule.createDomainOrders([
    {
      tenant_id: ctx.tenant.id,
      domain_name: domainName,
      tld,
      action: "register",
      years,
      status: "awaiting_payment",
      price: totalUsd,
      currency: "USD",
      meta: {
        requested_by: ctx.merchant.id,
        privacy,
        auto_renew: autoRenew,
      },
      created_by_user_id: ctx.merchant.id,
    },
  ] as any)

  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(ctx.tenant.billing_country ?? "US", cfg)

  if (!(await gateway.isConfigured()) || !gateway.createPurchaseCheckout) {
    await domainsModule.updateDomainOrders({ id: order.id, status: "cancelled" })
    return res.status(503).json({
      message:
        "Domains are paid by card, and card payments aren't switched on yet. Please contact support.",
    })
  }

  const base =
    process.env.MERCHANT_APP_URL || `https://${ctx.tenant.slug}.mautomate.ai`
  const checkout = await gateway.createPurchaseCheckout({
    tenant_id: ctx.tenant.id,
    kind: "domain",
    ref: order.id,
    description: `${domainName} — ${years} year${years === 1 ? "" : "s"} registration`,
    amount_usd: totalUsd,
    success_url: `${base}/dashboard/domains?purchased=${encodeURIComponent(domainName)}`,
    cancel_url: `${base}/dashboard/domains?cancelled=1`,
  })

  if (!checkout.ok) {
    await domainsModule.updateDomainOrders({ id: order.id, status: "cancelled" })
    return res.status(502).json({ message: checkout.error ?? "could not start checkout" })
  }

  return res.json({
    ok: true,
    awaiting_payment: true,
    order_id: order.id,
    domain: domainName,
    price_usd: totalUsd,
    years,
    checkout_url: checkout.data!.url,
  })
}
