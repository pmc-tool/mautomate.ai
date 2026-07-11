/**
 * Billing lifecycle state machine (plan §06).
 *
 * A tenant's account moves through these states as payments succeed/fail and
 * grace windows elapse. Pure + total: `nextLifecycleState` is the single source
 * of truth, unit-tested, and drives the suspension/de-provision sagas.
 *
 *   active ──payment_failed──▶ past_due ──grace_started──▶ grace
 *   grace  ──grace_expired───▶ suspended ──retention_expired──▶ retained
 *   retained ──purge─────────▶ purged
 *   (any non-purged) ──payment_succeeded──▶ active
 *   (any non-purged) ──abuse_detected─────▶ suspended   (distinct from billing)
 */
export type LifecycleState =
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "retained"
  | "purged"

export type LifecycleEvent =
  | "payment_failed"
  | "payment_succeeded"
  | "grace_started"
  | "grace_expired"
  | "retention_expired"
  | "purge"
  | "abuse_detected"

export const nextLifecycleState = (
  current: LifecycleState,
  event: LifecycleEvent
): LifecycleState => {
  if (current === "purged") return "purged" // terminal

  // recovery + abuse apply from any non-terminal state
  if (event === "payment_succeeded") return "active"
  if (event === "abuse_detected") return "suspended"

  switch (current) {
    case "active":
      return event === "payment_failed" ? "past_due" : current
    case "past_due":
      return event === "grace_started" ? "grace" : current
    case "grace":
      return event === "grace_expired" ? "suspended" : current
    case "suspended":
      return event === "retention_expired" ? "retained" : current
    case "retained":
      return event === "purge" ? "purged" : current
    default:
      return current
  }
}

/** Is the store allowed to serve traffic / spend credits in this state? */
export const isServiceable = (s: LifecycleState): boolean =>
  s === "active" || s === "past_due"
