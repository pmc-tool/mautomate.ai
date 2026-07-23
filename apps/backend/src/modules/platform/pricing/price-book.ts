/**
 * price-book — the vendor-cost → credit price table (plan §06, corrected).
 *
 * 1 credit = $0.01. Rates are destination-tiered-aware (Bangladesh pilot) and
 * the TTS model is pinned to a cost tier, not the premium default. These are the
 * numbers the metering hooks charge; keep them here so pricing is one source of
 * truth and unit-testable.
 */
export type BillableAction =
  | "ai_call_minute" // web call (no telco leg)
  | "ai_call_phone_minute" // phone call (adds the Twilio leg)
  | "phone_number_month" // recurring number rental
  | "sms_segment"
  | "ai_text" // one field rewrite
  | "ai_node_edit" // one selected-section AI edit (Tier 2 node patch)
  | "ai_page_edit" // an AI page edit (2-stage)
  | "ai_content" // long-form: blog/article/product copy
  | "ai_image"
  | "ai_logo" // image + background removal
  | "ai_video" // AI motion clip (image-to-video / prompt-to-video)
  | "ai_image_basic"
  | "social_publish" // free: costs us nothing, drives usage
  | "email_batch" // 1 credit per 10 emails (never fractional)
  | "email"
  | "domain_purchase_usd"
  | "ai_ad_campaign" // full AI ad-campaign draft (copy + audience + structure)
  | "ads_autopilot_day" // one day of autopilot optimization on a tenant

export type PriceRow = {
  action: BillableAction
  credits: number // credits per unit
  vendor_cost_usd: number // approx blended vendor cost per unit (for reconciliation)
}

export const PRICE_BOOK: Record<BillableAction, PriceRow> = {
  // Voice: our profit engine. Vendor = Deepgram STT + TTS + LLM (+ Twilio on phone).
  ai_call_minute: { action: "ai_call_minute", credits: 15, vendor_cost_usd: 0.03 },
  ai_call_phone_minute: { action: "ai_call_phone_minute", credits: 18, vendor_cost_usd: 0.04 },
  phone_number_month: { action: "phone_number_month", credits: 300, vendor_cost_usd: 1.15 },
  // Thinnest margin on the board — carrier fees move; watch this one.
  sms_segment: { action: "sms_segment", credits: 2, vendor_cost_usd: 0.011 },
  // Near-free to us, generous to them: makes the product feel unlimited.
  ai_text: { action: "ai_text", credits: 2, vendor_cost_usd: 0.0005 },
  // Selection-scoped node edit (ARCH-AI §3.3): between ai_text and ai_page_edit.
  ai_node_edit: { action: "ai_node_edit", credits: 3, vendor_cost_usd: 0.001 },
  ai_page_edit: { action: "ai_page_edit", credits: 5, vendor_cost_usd: 0.002 },
  ai_content: { action: "ai_content", credits: 10, vendor_cost_usd: 0.01 },
  // Images sell the platform — deliberately thin (3x).
  ai_image: { action: "ai_image", credits: 12, vendor_cost_usd: 0.039 },
  ai_logo: { action: "ai_logo", credits: 15, vendor_cost_usd: 0.056 },
  // Video is the priciest vendor action (SVD-XT motion synthesis, ~4s clip,
  // and the prompt path first generates a still). Priced with real headroom
  // so a single clip can never run us into the red on a trial burn.
  ai_video: { action: "ai_video", credits: 60, vendor_cost_usd: 0.15 },
  ai_image_basic: { action: "ai_image_basic", credits: 2, vendor_cost_usd: 0.003 },
  // Costs us nothing; drives the habit that burns paid credits elsewhere.
  social_publish: { action: "social_publish", credits: 0, vendor_cost_usd: 0 },
  // Sub-credit actions are BATCHED, never fractional (integer credit columns).
  email_batch: { action: "email_batch", credits: 1, vendor_cost_usd: 0.001 },
  email: { action: "email", credits: 1, vendor_cost_usd: 0.0001 },
  // DEPRECATED: domains are paid by CARD, not credits (see domains/buy).
  // The row stays so historic usage rows still resolve a label.
  domain_purchase_usd: {
    action: "domain_purchase_usd",
    credits: 100,
    vendor_cost_usd: 1,
  },
  // Advertising panel (charged from the AI layer phase; creatives bill their
  // own existing actions on top). Ad SPEND is the merchant's own card at the
  // platform — credits price only the intelligence.
  ai_ad_campaign: { action: "ai_ad_campaign", credits: 25, vendor_cost_usd: 0.01 },
  ads_autopilot_day: { action: "ads_autopilot_day", credits: 3, vendor_cost_usd: 0.002 },
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

/** Credits to charge for `units` of `action` — always a WHOLE credit.
 *  The wallet/ledger columns are integers by design, so any fractional charge
 *  would silently round. Sub-credit actions must be billed in batches instead
 *  (e.g. email: 1 credit per 10 sends), never as a fraction. */
export const creditsFor = (action: BillableAction, units = 1): number => {
  const override = RATE_OVERRIDES.get(action)
  const perUnit = override !== undefined ? override : PRICE_BOOK[action]?.credits
  if (perUnit === undefined) throw new Error(`unknown billable action: ${action}`)
  const raw = perUnit * units
  return Math.ceil(raw)
}

/** The margin multiple for an action (customer credits value ÷ vendor cost). */
/** Blended vendor cost for a metered action — the truth behind the margin. */
export const vendorCostFor = (action: BillableAction, units = 1): number => {
  const row = PRICE_BOOK[action]
  return row ? row.vendor_cost_usd * units : 0
}

/** Credits per single unit (lets us derive units back from a credit amount). */
export const creditsPerUnit = (action: BillableAction): number => {
  const override = RATE_OVERRIDES.get(action)
  return override !== undefined ? override : PRICE_BOOK[action]?.credits ?? 0
}

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
  { key: "free_trial", price_usd: 0, included_credits: 200, fixed_infra_usd: 10 },
  { key: "starter", price_usd: 19, included_credits: 1500, fixed_infra_usd: 10 },
  { key: "growth", price_usd: 49, included_credits: 5000, fixed_infra_usd: 10 },
  { key: "pro", price_usd: 99, included_credits: 12000, fixed_infra_usd: 8 },
  { key: "scale", price_usd: 249, included_credits: 35000, fixed_infra_usd: 6 },
]

/**
 * Top-up packs — PURCHASED credits, which NEVER expire (see credit_lot).
 * Bigger packs are cheaper per credit; every pack is dearer per credit than a
 * subscription, so the plans stay the better deal.
 */
export type Pack = { credits: number; price_usd: number }
export const PACKS: Pack[] = [
  { credits: 1000, price_usd: 12 },
  { credits: 5000, price_usd: 50 },
  { credits: 15000, price_usd: 135 },
  { credits: 50000, price_usd: 400 },
]

/** Which plans may use the expensive, abuse-prone channels. */
export const PLAN_GATES: Record<
  string,
  { phone: boolean; sms: boolean; images: number | null; videos: number | null }
> = {
  // Video is our priciest action, so a trial gets a taste (3 clips) — enough to
  // see the magic, not enough to burn real vendor money before they ever pay.
  free_trial: { phone: false, sms: false, images: 16, videos: 3 },
  starter: { phone: false, sms: true, images: null, videos: null },
  growth: { phone: true, sms: true, images: null, videos: null },
  pro: { phone: true, sms: true, images: null, videos: null },
  scale: { phone: true, sms: true, images: null, videos: null },
}

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
