/**
 * Tiny, dependency-free structured logger for the call-center module.
 *
 * WHY: a call flows across many surfaces — HTTP routes, the dial sweep, the
 * voice runtime bridge, webhooks, retries. To trace one call end-to-end you
 * need every log line to carry the same `call_id` and be machine-parseable.
 * `ccLog` emits exactly one JSON line per call so a log aggregator (or a simple
 * `grep call_id=...`) can reconstruct the full timeline of a single call.
 *
 * Every line is tagged `{ svc: "call-center", scope, event, ...data, at }`:
 *   - svc    constant, lets you filter all call-center logs in a shared stream
 *   - scope  the subsystem emitting (e.g. "dial", "voice", "webhook", "health")
 *   - event  a short verb/noun (e.g. "call.queued", "task.claimed")
 *   - ...data arbitrary structured fields — put `call_id`/`task_id` here
 *   - at     ISO timestamp, added automatically
 *
 * No external deps on purpose: this must be safe to import from anywhere in the
 * module (services, steps, routes) without pulling in a logging framework.
 */

/** Structured fields attached to a log line. Include `call_id` to enable tracing. */
export type CcLogData = Record<string, unknown>

/** The full shape of an emitted log record. */
export type CcLogRecord = {
  svc: "call-center"
  scope: string
  event: string
  at: string
} & CcLogData

const buildRecord = (
  scope: string,
  event: string,
  data?: CcLogData
): CcLogRecord => ({
  svc: "call-center",
  scope,
  event,
  ...(data ?? {}),
  at: new Date().toISOString(),
})

/**
 * Emit a single structured JSON log line for the call-center module.
 *
 * Routes to `console.error` for error-shaped events (event contains "error" or
 * "fail", or `data.level === "error"`) so they surface on stderr; everything
 * else goes to `console.log`. Returns the emitted record for convenience/tests.
 */
export const ccLog = (
  scope: string,
  event: string,
  data?: CcLogData
): CcLogRecord => {
  const record = buildRecord(scope, event, data)
  const isError =
    data?.level === "error" ||
    /error|fail/i.test(event)

  const line = JSON.stringify(record)
  if (isError) {
    console.error(line)
  } else {
    console.log(line)
  }
  return record
}

/**
 * Convenience wrapper that always emits at error level (stderr). Use for caught
 * exceptions so the `level: "error"` field is set consistently.
 */
export const ccError = (
  scope: string,
  event: string,
  data?: CcLogData
): CcLogRecord => ccLog(scope, event, { ...(data ?? {}), level: "error" })

/**
 * traceId passthrough helpers.
 *
 * The system-of-record trace id IS the call's `call_id` — we deliberately do
 * NOT mint a competing id. `traceId(callId)` normalizes whatever id you hand it
 * (call id, provider call id, task id) into a trace string; when nothing is
 * known it returns `undefined` so the field is simply omitted from logs rather
 * than polluted with a fake id.
 */
export const traceId = (id?: string | null): string | undefined =>
  id ?? undefined

/**
 * Bind a scope + a trace id (call_id) once and get back a logger that stamps
 * both onto every line. Lets a step thread its call_id through without repeating
 * it at each `ccLog` call site.
 */
export const withTrace = (scope: string, callId?: string | null) => {
  const call_id = traceId(callId)
  return (event: string, data?: CcLogData): CcLogRecord =>
    ccLog(scope, event, { ...(call_id ? { call_id } : {}), ...(data ?? {}) })
}
