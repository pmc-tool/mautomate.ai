import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { applyMarkup, markupPrice } from "../_shared"
import { searchDomains } from "../../../../modules/domains/domain-service"
import { isResellerConfigured } from "../../../../modules/domains/provider"

const DEFAULT_TLDS = ["com", "net", "org", "io", "co", "shop", "store", "xyz"]
const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")

function normalizeQuery(raw: unknown): string {
  const q = String(raw ?? "").trim().toLowerCase()
  return q.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "")
}

function extractSld(query: string): string {
  return query.includes(".") ? query.split(".")[0] : query
}

/**
 * Normalize one provider availability result so `domain` is ALWAYS the FULL
 * domain (sld.tld). The registrar provider returns `domain` as the sld only
 * (e.g. { domain: "mystore", tld: "com" }); if that leaks through, the page and
 * the buy route see "mystore" with no TLD and registration 400s. Also applies
 * the reseller markup to the displayed price so it matches what buy charges.
 */
function normalizeResult(r: any) {
  const sld = String(r?.domain ?? "")
  const tld = String(r?.tld ?? "")
  const full = sld.includes(".") || !tld ? sld : `${sld}.${tld}`
  return { ...r, domain: full, tld, price: markupPrice(r?.price) }
}

function fallbackResults(query: string, tlds: string[]) {
  const sld = extractSld(query)
  const price = applyMarkup(FALLBACK_PRICE_USD)
  return tlds.map((tld) => ({
    domain: `${sld}.${tld}`,
    tld,
    available: true,
    status: "available",
    isPremium: false,
    price: {
      register: price,
      renew: price,
      transfer: price,
      currency: "USD",
    },
  }))
}

/**
 * POST /merchant/domains/search
 *
 * Search domain availability across TLDs. Uses the configured ResellerClub
 * provider when present; otherwise returns transparent fallback pricing so
 * the merchant can still request a manual-approval purchase. Results always
 * carry the FULL domain in `domain` and markup-adjusted pricing.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const query = normalizeQuery(body.query)
  const tlds = Array.isArray(body.tlds) && body.tlds.length
    ? body.tlds.map(String)
    : DEFAULT_TLDS

  if (!query || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(extractSld(query))) {
    return res.status(400).json({ message: "enter a valid domain name, e.g. mystore" })
  }

  if (!isResellerConfigured()) {
    return res.json({
      query,
      configured: false,
      results: fallbackResults(query, tlds),
      note: "Registrar is not configured. Purchases are handled as manual approvals.",
    })
  }

  const result = await searchDomains(req.scope, {
    tenantId: ctx.tenant.id,
    query,
    tlds,
  })

  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "availability lookup failed" })
  }

  res.json({
    query: result.data?.query ?? query,
    configured: true,
    results: (result.data?.results ?? []).map(normalizeResult),
  })
}
