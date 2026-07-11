/**
 * Agent Console — shared data layer for the Call Center admin extension.
 *
 * Thin typed wrappers over the /admin/call-center/* API (cookie-session auth via
 * credentials:"include"). Every helper returns parsed JSON or throws an Error
 * carrying the backend's friendly message so callers can `toast.error(e.message)`.
 *
 * This file is NOT a route — the admin router only registers `page.tsx` files,
 * so a plain module under `_components/` is import-only. It is intentionally the
 * one place the sibling subpages (calls / campaigns / playbooks / settings, each
 * owned by another agent) import types, formatters and fetchers from, so the
 * whole console speaks one contract.
 *
 * Shapes mirror the admin API contract:
 *   GET  /admin/call-center                 -> DashboardSummary
 *   GET  /admin/call-center/calls           -> { calls, count, limit, offset }
 *   GET  /admin/call-center/tasks           -> { tasks, count, limit, offset }
 *   GET  /admin/call-center/kill-switch     -> KillSwitchState
 *   POST /admin/call-center/kill-switch     -> { action, outbound_halted, ... }
 *
 * LIVE TRANSCRIPT NOTE: this layer polls the REST endpoints above. A true live
 * transcript / per-call event stream is served over SSE at
 * /admin/call-center/stream (built by another agent) — subscribe to that for
 * token-by-token updates rather than polling here.
 */

/* ------------------------------------------------------------------ */
/* Types (mirror the call_center_* models)                             */
/* ------------------------------------------------------------------ */

export type CallDirection = "inbound" | "outbound"

export type CallStatus =
  | "queued"
  | "dialing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "voicemail"
  | "canceled"

export type CallTaskStatus =
  | "scheduled"
  | "claimed"
  | "in_progress"
  | "done"
  | "failed"
  | "canceled"

/** A telephony call row (call_center_call). */
export type Call = {
  id: string
  tenant_id: string
  order_id: string | null
  customer_id: string | null
  direction: CallDirection
  status: CallStatus
  from_number: string | null
  to_number: string | null
  locale: string | null
  playbook_id: string | null
  playbook_version: string | null
  disposition: string | null
  summary: string | null
  sentiment: string | null
  recording_url: string | null
  cost_total: number
  provider_call_id: string | null
  campaign_id: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

/** A unit of dial work (call_center_call_task) — used for "callbacks due". */
export type CallTask = {
  id: string
  tenant_id: string
  order_id: string | null
  customer_id: string | null
  playbook_id: string | null
  direction: CallDirection
  status: CallTaskStatus
  scheduled_at: string
  attempts: number
  max_attempts: number
  next_retry_at: string | null
  campaign_id: string | null
  locale: string | null
  priority: number
  created_at: string
  updated_at: string
}

/** GET /admin/call-center dashboard summary. */
export type DashboardSummary = {
  tenant_id: string
  calls_today: {
    total: number
    by_status: Partial<Record<CallStatus, number>> & Record<string, number>
  }
  tasks_scheduled: number
  campaigns_running: number
}

/** GET /admin/call-center/kill-switch state. */
export type KillSwitchState = {
  enabled: boolean
  outbound_halted: boolean
  running_campaigns: number
}

export type KillSwitchResult = {
  action: "halt" | "resume"
  outbound_halted: boolean
  paused_campaigns?: number
  message?: string
}

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export function getSummary(): Promise<DashboardSummary> {
  return api(`/admin/call-center`)
}

export function listCalls(params?: {
  status?: CallStatus
  direction?: CallDirection
  order_id?: string
  campaign_id?: string
  limit?: number
  offset?: number
}): Promise<{ calls: Call[]; count: number; limit: number; offset: number }> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.direction) qs.set("direction", params.direction)
  if (params?.order_id) qs.set("order_id", params.order_id)
  if (params?.campaign_id) qs.set("campaign_id", params.campaign_id)
  qs.set("limit", String(params?.limit ?? 100))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/call-center/calls?${qs.toString()}`)
}

export function listTasks(params?: {
  status?: CallTaskStatus
  limit?: number
  offset?: number
}): Promise<{
  tasks: CallTask[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  qs.set("limit", String(params?.limit ?? 100))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/call-center/tasks?${qs.toString()}`)
}

export function getKillSwitch(): Promise<KillSwitchState> {
  return api(`/admin/call-center/kill-switch`)
}

export function setKillSwitch(
  action: "halt" | "resume"
): Promise<KillSwitchResult> {
  return api(`/admin/call-center/kill-switch`, {
    method: "POST",
    json: { action },
  })
}

/* ------------------------------------------------------------------ */
/* Live-queue derivations                                              */
/* ------------------------------------------------------------------ */

/** Statuses that mean a call is currently on the wire / about to be. */
export const ACTIVE_CALL_STATUSES: CallStatus[] = [
  "queued",
  "dialing",
  "in_progress",
]

/** Statuses that mean a call has ended (any outcome). */
export const TERMINAL_CALL_STATUSES: CallStatus[] = [
  "completed",
  "failed",
  "no_answer",
  "voicemail",
  "canceled",
]

export const isActiveCall = (c: Call): boolean =>
  ACTIVE_CALL_STATUSES.includes(c.status)

/**
 * Heuristic for "waiting for a human". The data model has no first-class
 * escalation status, so we flag a call as needing a human when its disposition
 * or summary mentions a handoff, or sentiment turned negative. When the SSE
 * channel lands it can emit an explicit `escalated` signal that supersedes this.
 */
const HUMAN_HINT = /(escalat|handoff|hand[- ]off|transfer|human|agent|supervisor)/i

export const needsHuman = (c: Call): boolean => {
  if (c.sentiment && /negativ|angry|frustrat/i.test(c.sentiment)) return true
  if (c.disposition && HUMAN_HINT.test(c.disposition)) return true
  if (c.summary && HUMAN_HINT.test(c.summary)) return true
  return false
}

/** A callback/task is "due" when it is still scheduled (or already claimed). */
export const isCallbackDue = (t: CallTask): boolean =>
  t.status === "scheduled" || t.status === "claimed"

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/** Short relative label, e.g. "in 5m", "2m ago", "now". */
export const formatRelative = (iso: string | null): string => {
  if (!iso) return "—"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diffSec = Math.round((t - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  const future = diffSec > 0
  let value: string
  if (abs < 45) return "now"
  if (abs < 3600) value = `${Math.round(abs / 60)}m`
  else if (abs < 86400) value = `${Math.round(abs / 3600)}h`
  else value = `${Math.round(abs / 86400)}d`
  return future ? `in ${value}` : `${value} ago`
}

/**
 * Live duration of a call. Uses started_at -> ended_at, or started_at -> now for
 * an in-flight call. Returns "m:ss" (or "—" when not started).
 */
export const formatDuration = (call: Call): string => {
  if (!call.started_at) return "—"
  const start = new Date(call.started_at).getTime()
  const end = call.ended_at ? new Date(call.ended_at).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—"
  const totalSec = Math.floor((end - start) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/* Status -> Badge colour maps (shared with StatusBadge + subpages)    */
/* ------------------------------------------------------------------ */

export type BadgeColor = "green" | "red" | "blue" | "orange" | "grey" | "purple"

export const CALL_STATUS_BADGE: Record<
  CallStatus,
  { label: string; color: BadgeColor }
> = {
  queued: { label: "Queued", color: "grey" },
  dialing: { label: "Dialing", color: "blue" },
  in_progress: { label: "In progress", color: "green" },
  completed: { label: "Completed", color: "green" },
  failed: { label: "Failed", color: "red" },
  no_answer: { label: "No answer", color: "orange" },
  voicemail: { label: "Voicemail", color: "purple" },
  canceled: { label: "Canceled", color: "grey" },
}

export const TASK_STATUS_BADGE: Record<
  CallTaskStatus,
  { label: string; color: BadgeColor }
> = {
  scheduled: { label: "Scheduled", color: "blue" },
  claimed: { label: "Claimed", color: "purple" },
  in_progress: { label: "In progress", color: "green" },
  done: { label: "Done", color: "green" },
  failed: { label: "Failed", color: "red" },
  canceled: { label: "Canceled", color: "grey" },
}
