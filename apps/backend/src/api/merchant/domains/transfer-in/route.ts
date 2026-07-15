import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { applyMarkup, normalizeDomain } from "../_shared"
import {
  searchDomains,
  transferInDomain,
} from "../../../../modules/domains/domain-service"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import { isResellerConfigured } from "../../../../modules/domains/provider"
import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"

const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")
const MANUAL_APPROVAL_ENABLED =
  process.env.DOMAIN_MANUAL_APPROVAL_ENABLED !== "0"

function splitDomain(domain: string): { sld: string; tld: string } {
  const idx = domain.lastIndexOf(".")
  if (idx === -1) return { sld: domain, tld: "" }
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) }
}

/**
 * POST /merchant/domains/transfer-in { domain, auth_code }
 *
 * Transfer a domain IN using its EPP/auth code. Credits are reserved for the
 * transfer price (registrar cost + reseller markup) up front, then committed on
 * success or released on failure — same discipline as the buy route.
 *
 * When the registrar is configured the transfer is submitted in real time via
 * transferInDomain (which requires a registrant profile — create one at
 * POST /merchant/domains/contacts first). When it is not configured we fall back
 * to a manual-approval flow: credits are collected and a pending transfer order +
 * domain row are recorded for a platform operator to complete at the registrar.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const domain = normalizeDomain(body.domain ?? body.domain_name)
  const authCode = String(body.auth_code ?? body.authCode ?? "")
  const years = Math.min(Math.max(Number(body.years ?? 1), 1), 10)
  const privacy = !!body.privacy
  const autoRenew = !!body.auto_renew

  if (!domain || !/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. example.com" })
  }
  if (!authCode) {
    return res.status(400).json({ message: "auth_code (EPP code) is required" })
  }

  const { tld } = splitDomain(domain)
  if (!tld) {
    return res.status(400).json({ message: "domain must include a TLD" })
  }

  const domainsModule: any = req.scope.resolve(DOMAINS_MODULE)

  // de-dup: a domain can belong to only one tenant.
  const clash = await domainsModule
    .listDomainModels({ domain_name: domain })
    .catch(() => [])
  const foreign = (clash || []).find((r: any) => r.tenant_id !== ctx.tenant.id)
  if (foreign) {
    return res.status(409).json({ message: `${domain} is already managed by another store` })
  }

  const configured = isResellerConfigured()
  let unitPriceUsd = FALLBACK_PRICE_USD

  if (configured) {
    const search = await searchDomains(req.scope, {
      tenantId: ctx.tenant.id,
      query: domain,
      tlds: [tld],
    })
    if (!search.ok) {
      return res.status(502).json({ message: search.error ?? "price lookup failed" })
    }
    const hit = (search.data?.results ?? []).find(
      (r: any) => `${r.domain}.${r.tld}` === domain || r.domain === domain
    )
    const rawPrice = hit?.price?.transfer ?? hit?.price?.register ?? 0
    unitPriceUsd = rawPrice > 0 ? rawPrice : FALLBACK_PRICE_USD
  }

  // Reseller markup applied to the registrar cost.
  const totalUsd = applyMarkup(unitPriceUsd) * years

  // A transfer is a registrar fee — REAL MONEY, not AI credits. Same rule as a
  // purchase: take the card first, move the domain only once payment clears.
  const [order] = await domainsModule.createDomainOrders([
    {
      tenant_id: ctx.tenant.id,
      domain_name: domain,
      tld,
      action: "transfer",
      years,
      status: "awaiting_payment",
      price: totalUsd,
      currency: "USD",
      meta: {
        requested_by: ctx.merchant.id,
        privacy,
        auto_renew: autoRenew,
        auth_code: authCode,
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
        "Domain transfers are paid by card, and card payments aren't switched on yet. Please contact support.",
    })
  }

  const base =
    process.env.MERCHANT_APP_URL || `https://${ctx.tenant.slug}.mautomate.ai`
  const checkout = await gateway.createPurchaseCheckout({
    tenant_id: ctx.tenant.id,
    kind: "domain_transfer",
    ref: order.id,
    description: `${domain} — transfer in (${years} year${years === 1 ? "" : "s"})`,
    amount_usd: totalUsd,
    success_url: `${base}/dashboard/domains?transferred=${encodeURIComponent(domain)}`,
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
    domain,
    price_usd: totalUsd,
    years,
    checkout_url: checkout.data!.url,
  })
}
