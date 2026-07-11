/**
 * Pure aggregation helpers over an array of `call_center_call` rows.
 *
 * These functions are intentionally side-effect free: they take a plain array
 * of calls and return computed KPIs. No DB, no container, no I/O — which makes
 * them trivially unit-testable and reusable by the analytics route, a future
 * scheduled rollup, or an export job.
 *
 * SCOPE — v1 (Medusa-observable KPIs only):
 *   Everything here is derivable from fields Medusa already records on a Call
 *   (status, disposition, sentiment, cost_total, started_at, ended_at, ...).
 *
 *   DELIBERATELY NOT COMPUTED HERE: RTO (return-to-origin), NDR (non-delivery
 *   report) and first-attempt delivery rate. Those are courier/logistics
 *   outcomes that live in the carrier feed, NOT in the call record — they land
 *   in Phase 2 when the courier feed is wired in. Do not fake them from call
 *   data; a wrong delivery KPI is worse than an absent one.
 */

/** Minimal shape this module reads off a Call. Extra fields are ignored. */
export type AggregatableCall = {
  status?: string | null
  direction?: string | null
  disposition?: string | null
  sentiment?: string | null
  cost_total?: number | null
  started_at?: Date | string | null
  ended_at?: Date | string | null
  playbook_id?: string | null
  campaign_id?: string | null
  locale?: string | null
}

/** A `{ key -> count }` tally. */
export type Breakdown = Record<string, number>

/** Statuses that count as a successfully connected/handled conversation. */
const CONNECTED_STATUSES = new Set(["in_progress", "completed"])

/**
 * Statuses that represent an actual dial attempt (i.e. we tried to reach the
 * contact). Queued calls have not been attempted yet and are excluded from the
 * connect-rate denominator.
 */
const ATTEMPTED_STATUSES = new Set([
  "in_progress",
  "completed",
  "failed",
  "no_answer",
  "voicemail",
])

/**
 * Dispositions that mean the AI did NOT contain the call on its own — it had to
 * escalate to a human or the caller explicitly asked for one. Anything else
 * that reached `completed` is treated as contained (self-resolved).
 */
const NON_CONTAINED_DISPOSITIONS = new Set([
  "transfer",
  "transferred",
  "needs_human",
  "escalated",
  "escalation",
  "agent_requested",
])

/** Coerce a Date | ISO-string | null into epoch millis, or null. */
const toMillis = (value: Date | string | null | undefined): number | null => {
  if (!value) {
    return null
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/** Local YYYY-MM-DD key for a timestamp (used to bucket by day). */
const toDayKey = (value: Date | string | null | undefined): string | null => {
  const millis = toMillis(value)
  if (millis === null) {
    return null
  }
  return new Date(millis).toISOString().slice(0, 10)
}

/** Count calls grouped by disposition (unset → "unknown"). */
export const outcomeBreakdown = (calls: AggregatableCall[]): Breakdown => {
  const out: Breakdown = {}
  for (const call of calls) {
    const key = call.disposition ?? "unknown"
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

/** Count calls grouped by status (unset → "unknown"). */
export const byStatus = (calls: AggregatableCall[]): Breakdown => {
  const out: Breakdown = {}
  for (const call of calls) {
    const key = call.status ?? "unknown"
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

/**
 * Connect rate = connected calls / attempted calls, in [0, 1].
 * Returns 0 when nothing was attempted (avoids divide-by-zero).
 */
export const connectRate = (calls: AggregatableCall[]): number => {
  let attempted = 0
  let connected = 0
  for (const call of calls) {
    const status = call.status ?? ""
    if (ATTEMPTED_STATUSES.has(status)) {
      attempted += 1
    }
    if (CONNECTED_STATUSES.has(status)) {
      connected += 1
    }
  }
  return attempted === 0 ? 0 : connected / attempted
}

/**
 * Containment rate = calls the AI resolved without a human / completed calls,
 * in [0, 1]. Only completed calls are considered (an unfinished call has no
 * settled containment outcome yet). Returns 0 when there are no completed calls.
 */
export const containmentRate = (calls: AggregatableCall[]): number => {
  let completed = 0
  let contained = 0
  for (const call of calls) {
    if (call.status !== "completed") {
      continue
    }
    completed += 1
    const disposition = (call.disposition ?? "").toLowerCase()
    if (!NON_CONTAINED_DISPOSITIONS.has(disposition)) {
      contained += 1
    }
  }
  return completed === 0 ? 0 : contained / completed
}

/**
 * Average handle time in seconds across calls that have both a start and an end
 * timestamp. Calls missing either bound (or with a negative span) are skipped.
 * Returns 0 when no call has a measurable duration.
 */
export const avgHandleTime = (calls: AggregatableCall[]): number => {
  let totalSeconds = 0
  let measured = 0
  for (const call of calls) {
    const start = toMillis(call.started_at)
    const end = toMillis(call.ended_at)
    if (start === null || end === null) {
      continue
    }
    const seconds = (end - start) / 1000
    if (seconds < 0) {
      continue
    }
    totalSeconds += seconds
    measured += 1
  }
  return measured === 0 ? 0 : totalSeconds / measured
}

/** Sum of `cost_total` across all calls (nullish treated as 0). */
export const totalCost = (calls: AggregatableCall[]): number => {
  let sum = 0
  for (const call of calls) {
    sum += call.cost_total ?? 0
  }
  return sum
}

/**
 * Calls bucketed by day (YYYY-MM-DD of `started_at`). Each bucket carries the
 * call count and the summed cost for that day. Calls without a valid
 * `started_at` are dropped (they cannot be placed on the timeline).
 */
export type DayBucket = { date: string; count: number; cost: number }

export const byDay = (calls: AggregatableCall[]): DayBucket[] => {
  const buckets = new Map<string, DayBucket>()
  for (const call of calls) {
    const day = toDayKey(call.started_at)
    if (day === null) {
      continue
    }
    const existing = buckets.get(day) ?? { date: day, count: 0, cost: 0 }
    existing.count += 1
    existing.cost += call.cost_total ?? 0
    buckets.set(day, existing)
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  )
}

/** Count calls grouped by sentiment (unset → "unknown"). */
export const sentimentBreakdown = (calls: AggregatableCall[]): Breakdown => {
  const out: Breakdown = {}
  for (const call of calls) {
    const key = call.sentiment ?? "unknown"
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}
