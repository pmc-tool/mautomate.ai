/**
 * price-book — the vendor-cost → credit price table (plan §06, corrected).
 *
 * 1 credit = $0.01. Rates are destination-tiered-aware (Bangladesh pilot) and
 * the TTS model is pinned to a cost tier, not the premium default. These are the
 * numbers the metering hooks charge; keep them here so pricing is one source of
 * truth and unit-testable.
 */
export type BillableAction =
  | "ai_call_minute"
  | "sms_segment"
  | "ai_text"
  | "ai_image"
  | "email"
  | "domain_purchase_usd"

export type PriceRow = {
  action: BillableAction
  credits: number // credits per unit
  vendor_cost_usd: number // approx blended vendor cost per unit (for reconciliation)
}

export const PRICE_BOOK: Record<BillableAction, PriceRow> = {
  ai_call_minute: { action: "ai_call_minute", credits: 20, vendor_cost_usd: 0.11 },
  sms_segment: { action: "sms_segment", credits: 6, vendor_cost_usd: 0.03 },
  ai_text: { action: "ai_text", credits: 2, vendor_cost_usd: 0.001 },
  ai_image: { action: "ai_image", credits: 10, vendor_cost_usd: 0.04 },
  email: { action: "email", credits: 0.2, vendor_cost_usd: 0.0004 },
  domain_purchase_usd: {
    action: "domain_purchase_usd",
    credits: 100,
    vendor_cost_usd: 1,
  },
}

export const CREDIT_USD = 0.01

// --- Editable rate overrides (price_book_entry) -----------------------------
// The operator retunes credit prices in the console; those DB rows become the
// source of truth once loaded into this in-process cache (populated by the
// metering guard's TTL refresh + the pricebook PUT route). Actions without an
// override fall back to the code defaults above, so the money path is fail-safe.
// The credits column is INTEGER, so only whole-number-default actions are made
// overridable (fractional ones like `email` always use the code default).
const RATE_OVERRIDES = new Map<BillableAction, number>()

export const setRateOverride = (action: string, credits: number): void => {
  const def = (PRICE_BOOK as Record<string, PriceRow>)[action]
  if (def && Number.isInteger(def.credits) && Number.isFinite(credits) && credits >= 0) {
    RATE_OVERRIDES.set(action as BillableAction, credits)
  }
}

export const loadRateOverrides = (
  rows: { action: string; credits: number | string }[]
): void => {
  RATE_OVERRIDES.clear()
  for (const r of rows || []) setRateOverride(r.action, Number(r.credits))
}

/** Credits to charge for `units` of `action` (rounded up to 0.1-credit granularity). */
export const creditsFor = (action: BillableAction, units = 1): number => {
  const override = RATE_OVERRIDES.get(action)
  const perUnit = override !== undefined ? override : PRICE_BOOK[action]?.credits
  if (perUnit === undefined) throw new Error(`unknown billable action: ${action}`)
  const raw = perUnit * units
  return Math.ceil(raw * 10) / 10
}

/** The margin multiple for an action (customer credits value ÷ vendor cost). */
export const marginFor = (action: BillableAction): number => {
  const row = PRICE_BOOK[action]
  const customerUsd = row.credits * CREDIT_USD
  return row.vendor_cost_usd > 0 ? customerUsd / row.vendor_cost_usd : Infinity
}

/** Package tiers (plan §06) — included credits + fixed-infra COGS for margin checks. */
export type Tier = {
  key: string
  price_usd: number
  included_credits: number
  fixed_infra_usd: number
}

export const TIERS: Tier[] = [
  { key: "free_trial", price_usd: 0, included_credits: 300, fixed_infra_usd: 10 },
  { key: "starter", price_usd: 29, included_credits: 500, fixed_infra_usd: 10 },
  { key: "growth", price_usd: 79, included_credits: 1500, fixed_infra_usd: 10 },
  { key: "pro", price_usd: 149, included_credits: 4000, fixed_infra_usd: 8 },
  { key: "scale", price_usd: 349, included_credits: 10000, fixed_infra_usd: 6 },
]

/**
 * Worst-case contribution margin for a paid tier: price − fixed infra − the
 * vendor cost if EVERY included credit is redeemed on the cheapest-margin action.
 */
export const worstCaseMargin = (tier: Tier): number => {
  // cheapest margin per credit = the action whose vendor $/credit is highest
  const worstUsdPerCredit = Math.max(
    ...Object.values(PRICE_BOOK).map((r) => r.vendor_cost_usd / r.credits)
  )
  const creditCogs = tier.included_credits * worstUsdPerCredit
  return tier.price_usd - tier.fixed_infra_usd - creditCogs
}
