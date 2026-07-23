/**
 * mobile-app — done-for-you Play Store / App Store publishing service pricing.
 *
 * SINGLE SOURCE OF TRUTH for the publish-service prices. The client NEVER sends
 * an amount: it sends only a `tier`, and the charge is ALWAYS derived here,
 * server-side, exactly like the credit top-up underpayment fix. The Stripe
 * webhook independently re-derives the expected amount from the tier constant
 * (NOT from client metadata, NOT even from the stored order amount) before it
 * records a paid publish order, so money and entitlement can never drift apart.
 *
 * `launch_usd` is the current 50%-off launch price; `regular_usd` is the
 * strike-through price shown next to it in the UI.
 */

export type PublishTier = "play" | "full"

export type PublishTierPrice = {
  tier: PublishTier
  /** Current charge (50% launch discount). Whole USD -> exact cents, no rounding drift. */
  launch_usd: number
  /** Regular list price, shown struck-through for display only. */
  regular_usd: number
  label: string
  description: string
}

export const MOBILE_APP_PUBLISH_PRICES: Record<PublishTier, PublishTierPrice> = {
  play: {
    tier: "play",
    launch_usd: 99, // 9900 cents
    regular_usd: 199,
    label: "Google Play publishing",
    description:
      "We publish your branded app to the Google Play Store under your developer account.",
  },
  full: {
    tier: "full",
    launch_usd: 174, // 17400 cents
    regular_usd: 349,
    label: "Play + App Store publishing",
    description:
      "We publish your branded app to BOTH the Google Play Store and the Apple App Store.",
  },
}

export const isPublishTier = (v: unknown): v is PublishTier =>
  v === "play" || v === "full"

/**
 * The publish tiers as a display list (regular + launch prices, in USD and
 * cents) for the merchant UI. Exposed by GET /merchant/mobile-app/service so
 * the price shown to the buyer is exactly what the server will charge.
 */
export const publishTiersForDisplay = () =>
  (Object.keys(MOBILE_APP_PUBLISH_PRICES) as PublishTier[]).map((t) => {
    const p = MOBILE_APP_PUBLISH_PRICES[t]
    return {
      tier: p.tier,
      label: p.label,
      description: p.description,
      regular_usd: p.regular_usd,
      launch_usd: p.launch_usd,
      regular_cents: Math.round(p.regular_usd * 100),
      launch_cents: Math.round(p.launch_usd * 100),
      discount_pct: Math.round((1 - p.launch_usd / p.regular_usd) * 100),
    }
  })

/**
 * Derive the store's Android/iOS bundle id from the tenant slug, per the
 * white-label factory contract: ai.mautomate.shopper.<slug-without-dashes>.
 * This is IDENTITY-CRITICAL (the app stores treat a changed id as a different
 * app), so it is ALWAYS derived server-side from the immutable slug and is
 * never accepted from the client.
 */
export const bundleIdForSlug = (slug: string): string => {
  const clean = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  return `ai.mautomate.shopper.${clean || "store"}`
}

/** #RGB / #RRGGBB validator for the first-paint splash accent color. */
export const isHexColor = (v: unknown): v is string =>
  typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
