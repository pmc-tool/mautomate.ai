import { MedusaRequest } from "@medusajs/framework/http"

import type { MerchantCtx } from "../_helpers"
import { DOMAINS_MODULE } from "../../../modules/domains"

/**
 * Shared helpers for the /merchant/domains routes.
 *
 * RESELLER MARKUP: the registrar (ResellerClub) returns our *cost*. Merchants
 * are shown and charged that cost plus a configurable markup so the platform
 * earns a margin. Set DOMAINS_MARKUP_PERCENT (e.g. "20" = +20%); default 0 keeps
 * behaviour unchanged. The same helper is applied in the search route (display)
 * and in the buy / transfer-in routes (credit charge) so what a merchant sees is
 * exactly what they pay.
 */
export const DOMAINS_MARKUP_PERCENT = Number(
  process.env.DOMAINS_MARKUP_PERCENT ?? "0"
)

/** Apply the configured reseller markup to a USD cost, rounded to cents. */
export const applyMarkup = (usd: number): number => {
  if (!usd || usd <= 0 || !Number.isFinite(usd)) {
    return usd
  }
  const pct = Number.isFinite(DOMAINS_MARKUP_PERCENT)
    ? DOMAINS_MARKUP_PERCENT
    : 0
  return Math.round(usd * (1 + pct / 100) * 100) / 100
}

/** Apply markup to a TldPrice-shaped bundle (register / renew / transfer). */
export const markupPrice = (price: any) => {
  if (!price || typeof price !== "object") {
    return price
  }
  return {
    ...price,
    register: price.register != null ? applyMarkup(price.register) : price.register,
    renew: price.renew != null ? applyMarkup(price.renew) : price.renew,
    transfer: price.transfer != null ? applyMarkup(price.transfer) : price.transfer,
    restore: price.restore != null ? applyMarkup(price.restore) : price.restore,
  }
}

/**
 * Fetch the tenant's local row for `domainName`, or null. Every merchant
 * [domain] route calls this and 404s on null, so a merchant can only ever touch
 * a domain that belongs to their own tenant (fail-closed / cross-tenant safe).
 */
export const findOwnedDomain = async (
  req: MedusaRequest,
  ctx: MerchantCtx,
  domainName: string
): Promise<any | null> => {
  const svc: any = req.scope.resolve(DOMAINS_MODULE)
  const rows = await svc
    .listDomainModels({ tenant_id: ctx.tenant.id, domain_name: domainName })
    .catch(() => [])
  return rows?.[0] ?? null
}

/** Normalize a raw domain input to a bare lowercase hostname. */
export const normalizeDomain = (raw: unknown): string =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
