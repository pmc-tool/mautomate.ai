import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Ensure every product in a store has a price in the store's currency.
 *
 * Medusa stores prices PER currency. When a merchant switches their store
 * currency (e.g. USD -> BDT), any variant that only has a price in the old
 * currency has NO price in the new one, so the storefront shows no amount at
 * all. This fills that gap: for each variant price set missing a price in
 * `currency`, it copies the amount from an existing price (preferring the old
 * default) into the new currency. The number is preserved — the merchant reviews
 * the actual value — but the store stays functional instead of showing blanks.
 *
 * Idempotent: a variant that already has a `currency` price is skipped, so this
 * is safe to run on every currency save (and to backfill an already-switched
 * store). Best-effort — never throws into the caller.
 *
 * Returns the number of variants given a new price.
 */
export async function ensureStorePricesInCurrency(
  scope: any,
  salesChannelId: string | undefined | null,
  currency: string,
  preferFrom?: string
): Promise<number> {
  const toCur = String(currency || "").toLowerCase()
  if (!salesChannelId || !toCur) return 0
  try {
    const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const pricing: any = scope.resolve(Modules.PRICING)

    const rows = await pg
      .select("pvps.price_set_id")
      .from("product_sales_channel as psc")
      .join("product as p", "p.id", "psc.product_id")
      .join("product_variant as pv", "pv.product_id", "p.id")
      .join("product_variant_price_set as pvps", "pvps.variant_id", "pv.id")
      .where("psc.sales_channel_id", salesChannelId)
      .whereNull("p.deleted_at")
      .whereNull("pv.deleted_at")

    const priceSetIds = Array.from(
      new Set((rows || []).map((r: any) => r.price_set_id).filter(Boolean))
    )
    if (!priceSetIds.length) return 0

    const priceSets = await pricing.listPriceSets(
      { id: priceSetIds },
      { relations: ["prices"], take: priceSetIds.length }
    )

    const from = String(preferFrom || "").toLowerCase()
    let migrated = 0
    for (const ps of priceSets || []) {
      const prices = (ps.prices || []).filter((pr: any) => !pr.deleted_at)
      const hasTarget = prices.some(
        (pr: any) => String(pr.currency_code || "").toLowerCase() === toCur
      )
      if (hasTarget) continue

      const src =
        (from &&
          prices.find(
            (pr: any) => String(pr.currency_code || "").toLowerCase() === from
          )) ||
        prices[0]
      if (!src) continue

      await pricing.addPrices({
        priceSetId: ps.id,
        prices: [{ amount: src.amount, currency_code: toCur }],
      })
      migrated++
    }
    return migrated
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[pricing] currency price migration failed (non-blocking):", e?.message ?? e)
    return 0
  }
}
