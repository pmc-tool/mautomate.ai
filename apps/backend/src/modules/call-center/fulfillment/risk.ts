/**
 * Deterministic fraud / risk pre-score for the AI call-center.
 *
 * PURPOSE
 * -------
 * Decide whether a freshly-placed order should be HELD for phone confirmation
 * before it is allowed to fulfill, or whether it can auto-release. This matters
 * most for Cash-on-Delivery (COD), where a fake/abandoned order costs real
 * shipping money.
 *
 * DESIGN
 * ------
 * This is a PURE, deterministic function over inputs the CALLER assembles. It
 * makes NO external calls (no DB, no gateway, no clock) so it is trivially unit
 * testable and always produces the same band for the same inputs. Whoever calls
 * it is responsible for gathering the signals (e.g. counting recently-cancelled
 * COD orders for the phone, checking the address blocklist) and passing them in.
 *
 * BANDS
 * -----
 *   "low"    -> auto-release, no confirmation call needed.
 *   "medium" -> hold for a confirmation call.
 *   "hard"   -> hold, strongest signal (treat as likely fraud / abuse).
 *
 * RULES (documented, evaluated additively; highest triggered band wins)
 * ---------------------------------------------------------------------
 *   1. Phone reused across N+ recently-cancelled COD orders -> "hard".
 *   2. Address on the internal blocklist                    -> "hard".
 *   3. High order value AND first-time buyer                -> "medium".
 *   4. Nothing above                                        -> "low".
 */

/** Minimal structural view of an order this scorer needs. Kept local so the */
/** scorer stays decoupled from the full gateway DTO and easy to unit test. */
export type RiskOrderView = {
  id?: string
  total?: number | null
  currency_code?: string | null
  phone?: string | null
}

export type RiskBand = "low" | "medium" | "hard"

export type RiskInput = {
  /** The order under evaluation (only a few fields are read). */
  order: RiskOrderView
  /**
   * How many recently-cancelled COD orders share this order's phone number.
   * The caller computes this (e.g. via gateway.findCustomersByPhone + a scan of
   * recent cancelled COD orders). Undefined / 0 means "no reuse signal".
   */
  priorCancelCount?: number
  /** True if the shipping address matches the internal blocklist. */
  addressBlocklisted?: boolean
  /** True if this buyer has no prior successful order (first-time customer). */
  isFirstTimeCustomer?: boolean
  /**
   * Order total to evaluate "high value" against. Falls back to `order.total`
   * when omitted. Amount is in the minor/major unit the caller normalizes; the
   * threshold below is compared directly, so pass a comparable number.
   */
  total?: number
  /** Currency of `total` (informational; threshold is currency-agnostic here). */
  currencyCode?: string
}

export type RiskResult = {
  /** Numeric pre-score (higher = riskier). Derived deterministically below. */
  score: number
  band: RiskBand
  /** Human-readable reasons for each triggered rule (for logs / agent UI). */
  reasons: string[]
}

/**
 * Number of recently-cancelled COD orders sharing a phone that flips the phone
 * into a "hard" fraud signal. Reused across >= this many cancellations means a
 * pattern, not a coincidence.
 */
export const COD_CANCEL_REUSE_THRESHOLD = 2

/**
 * Order total at/above which an order is considered "high value" for the
 * first-time-buyer rule. Currency-agnostic on purpose; the caller should pass a
 * normalized `total` (or override this constant per deployment if needed).
 */
export const HIGH_VALUE_THRESHOLD = 5000

/** Score contributions per rule. Band is derived from the summed score below. */
const SCORE_BLOCKLIST = 100
const SCORE_PHONE_REUSE = 80
const SCORE_HIGH_VALUE_FIRST_TIME = 40

/** Score thresholds that map the summed score onto a band. */
const HARD_AT = 80
const MEDIUM_AT = 40

/**
 * Deterministically score an order's fraud/hold risk. Pure — no side effects.
 */
export function scoreOrderRisk(input: RiskInput): RiskResult {
  const reasons: string[] = []
  let score = 0

  const priorCancelCount = input.priorCancelCount ?? 0
  const total = input.total ?? input.order.total ?? 0

  // Rule 1: phone reused across N+ recently-cancelled COD orders -> hard.
  if (priorCancelCount >= COD_CANCEL_REUSE_THRESHOLD) {
    score += SCORE_PHONE_REUSE
    reasons.push(
      `Phone reused across ${priorCancelCount} recently-cancelled COD orders (>= ${COD_CANCEL_REUSE_THRESHOLD})`
    )
  }

  // Rule 2: address on the internal blocklist -> hard.
  if (input.addressBlocklisted === true) {
    score += SCORE_BLOCKLIST
    reasons.push("Shipping address is on the internal blocklist")
  }

  // Rule 3: high value AND first-time buyer -> medium.
  if (input.isFirstTimeCustomer === true && total >= HIGH_VALUE_THRESHOLD) {
    score += SCORE_HIGH_VALUE_FIRST_TIME
    reasons.push(
      `High-value order (${total} >= ${HIGH_VALUE_THRESHOLD}) from a first-time customer`
    )
  }

  const band: RiskBand =
    score >= HARD_AT ? "hard" : score >= MEDIUM_AT ? "medium" : "low"

  if (band === "low" && reasons.length === 0) {
    reasons.push("No risk signals matched")
  }

  return { score, band, reasons }
}

/**
 * Whether an order in the given band should be HELD for a confirmation call.
 * Only "medium" and "hard" hold; "low" auto-releases.
 */
export function shouldHoldForConfirmation(band: RiskBand): boolean {
  return band === "medium" || band === "hard"
}
