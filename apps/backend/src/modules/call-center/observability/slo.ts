/**
 * Pure SLO / health-signal helpers over an array of `call_center_call` rows.
 *
 * Like `analytics/aggregate.ts`, these are side-effect free: array in, number
 * out. No DB, no container, no I/O — trivially unit-testable and reusable by the
 * health route, a scheduled alerter, or a dashboard rollup.
 *
 * WHAT THIS MODULE CAN AND CANNOT SEE
 *   The single most important voice-agent SLO is turn latency — the time from
 *   the caller finishing speaking to the first audio of the AI's reply. That is
 *   a property of the real-time media loop and can ONLY be measured inside the
 *   voice runtime (Pipecat) as it runs STT -> LLM -> TTS. The Medusa backend
 *   never sees the audio, so it CANNOT compute true turn latency here. The
 *   runtime must emit it (per-turn metric / on the call record) for us to report
 *   on it. `turnLatencyBudgetMs` below is the TARGET we hold the runtime to; the
 *   helpers in this file only compute signals that are observable from the
 *   backend-visible call rows (status, timestamps, cost).
 */

import type { AggregatableCall } from "../analytics/aggregate"

export type { AggregatableCall }

/**
 * Turn-latency budget: target time-to-first-audio for an AI reply, in ms.
 *
 * 800ms is the conversational threshold beyond which a caller perceives an
 * awkward pause. This is a TARGET, not a measured value — see the module doc:
 * the voice runtime (Pipecat) must emit the actual per-turn latency; this
 * constant is what alerting compares that emitted value against.
 */
export const turnLatencyBudgetMs = 800

/**
 * Call statuses that are terminal — the call is over, no more work will happen.
 * Anything NOT in this set is "live/pending" and can potentially get stuck.
 */
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "no_answer",
  "voicemail",
  "canceled",
])

/**
 * Statuses that count as an error outcome for error-rate purposes. `failed` is
 * the unambiguous failure; queued/dialing/in_progress are still in flight and
 * are neither successes nor errors, so they are excluded from the denominator.
 */
const ERROR_STATUSES = new Set(["failed"])

/**
 * Statuses that represent a resolved, non-error outcome. Together with
 * ERROR_STATUSES these form the error-rate denominator (settled calls only).
 */
const SETTLED_NON_ERROR_STATUSES = new Set([
  "completed",
  "no_answer",
  "voicemail",
  "canceled",
])

const toDate = (v: Date | string | null | undefined): Date | undefined => {
  if (!v) {
    return undefined
  }
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

const isSameUtcDay = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate()

/**
 * Fraction of settled calls that ended in an error, in [0, 1].
 *
 * Denominator = settled calls (errored + resolved-non-error). In-flight calls
 * (queued/dialing/in_progress) are excluded because their outcome is unknown.
 * Returns 0 when there is nothing settled to divide by.
 */
export const errorRate = (calls: AggregatableCall[]): number => {
  let errored = 0
  let settled = 0
  for (const c of calls) {
    const status = c.status ?? ""
    if (ERROR_STATUSES.has(status)) {
      errored++
      settled++
    } else if (SETTLED_NON_ERROR_STATUSES.has(status)) {
      settled++
    }
  }
  return settled === 0 ? 0 : errored / settled
}

/**
 * Calls that appear stuck: still in a non-terminal status AND older than
 * `thresholdMin` minutes. A call that started (or, lacking a start, was created)
 * long ago but never reached a terminal status is almost certainly wedged —
 * a hung media session, a crashed worker, a dropped webhook.
 *
 * Age is measured from `started_at` when present, else `ended_at` is ignored
 * (non-terminal rows rarely have it) and the row is treated as its own age via
 * `started_at` only; rows with no usable timestamp are not flagged (we cannot
 * prove they are old). `now` is injectable for deterministic tests.
 */
export const stuckCalls = (
  calls: AggregatableCall[],
  thresholdMin: number,
  now: Date = new Date()
): AggregatableCall[] => {
  const cutoffMs = now.getTime() - thresholdMin * 60_000
  return calls.filter((c) => {
    const status = c.status ?? ""
    if (TERMINAL_STATUSES.has(status)) {
      return false
    }
    const started = toDate(c.started_at)
    if (!started) {
      return false
    }
    return started.getTime() < cutoffMs
  })
}

/**
 * Sum of `cost_total` across calls whose `started_at` falls on today (UTC).
 * Calls without a valid `started_at` are ignored. `now` is injectable for tests.
 */
export const spendToday = (
  calls: AggregatableCall[],
  now: Date = new Date()
): number => {
  let total = 0
  for (const c of calls) {
    const started = toDate(c.started_at)
    if (started && isSameUtcDay(started, now)) {
      total += c.cost_total ?? 0
    }
  }
  return total
}

/**
 * Spend burn rate: cost per minute over the trailing `windowMin` minutes,
 * derived from calls started within that window. Useful to catch a runaway
 * dialer or a pricing spike before the daily budget is blown.
 *
 * Returns `{ window_min, spend, per_min }`. `per_min` is `spend / windowMin`
 * (0 when the window is non-positive). `now` is injectable for tests.
 */
export const spendBurnRate = (
  calls: AggregatableCall[],
  windowMin: number,
  now: Date = new Date()
): { window_min: number; spend: number; per_min: number } => {
  const cutoffMs = now.getTime() - windowMin * 60_000
  let spend = 0
  for (const c of calls) {
    const started = toDate(c.started_at)
    if (started && started.getTime() >= cutoffMs) {
      spend += c.cost_total ?? 0
    }
  }
  const per_min = windowMin > 0 ? spend / windowMin : 0
  return { window_min: windowMin, spend, per_min }
}
