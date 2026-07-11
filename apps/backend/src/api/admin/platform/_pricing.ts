import { PLATFORM_MODULE } from "../../../modules/platform"
import { TIERS, PRICE_BOOK, CREDIT_USD } from "../../../modules/platform/pricing/price-book"

/**
 * Lazily seed the persisted packages + price-book from the hardcoded defaults on
 * first read, so the operator console edits real DB rows (one source of truth)
 * instead of the TS constants. Idempotent.
 */
export async function ensurePricingSeed(scope: any) {
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const pkgs = await svc.listPlatformPackages({})
  if (!pkgs?.length) {
    await svc.createPlatformPackages(
      TIERS.map((t, i) => ({
        key: t.key,
        name: t.key.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        price_usd: t.price_usd,
        included_credits: t.included_credits,
        fixed_infra_usd: t.fixed_infra_usd,
        products_limit: null,
        seats_limit: null,
        domains_limit: null,
        features: null,
        active: true,
        sort: i,
      }))
    )
  }
  const pb = await svc.listPriceBookEntries({})
  if (!pb?.length) {
    await svc.createPriceBookEntries(
      Object.values(PRICE_BOOK).map((p: any) => ({
        action: p.action,
        credits: p.credits,
        vendor_cost_usd: p.vendor_cost_usd,
      }))
    )
  }
}

export async function readPricing(scope: any) {
  await ensurePricingSeed(scope)
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const tiers = (await svc.listPlatformPackages({})).sort((a: any, b: any) => a.sort - b.sort)
  const entries = await svc.listPriceBookEntries({})
  const price_book: Record<string, any> = {}
  for (const e of entries) price_book[e.action] = { action: e.action, credits: Number(e.credits), vendor_cost_usd: Number(e.vendor_cost_usd) }
  return { tiers, price_book, credit_usd: CREDIT_USD }
}
