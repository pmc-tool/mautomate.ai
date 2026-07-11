/**
 * AI Call Center — admin Calls data layer.
 *
 * Thin typed wrappers over the /admin/call-center/calls API plus the standard
 * Medusa admin store endpoints used to compose the Customer-360 panel
 * (/admin/orders/:id, /admin/customers/:id). Cookie-session auth via
 * credentials:"include". Every helper returns parsed JSON or throws an Error
 * carrying the backend's friendly message so callers can toast.error(e.message).
 *
 * This file is NOT a route — the admin router only registers page.tsx files, so
 * a plain lib.ts under _components/ is import-only.
 */

/* ------------------------------------------------------------------ */
/* Types (mirror the call_center_call contract)                        */
/* ------------------------------------------------------------------ */

export type CallDirection = "inbound" | "outbound" | string

export type CallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "in-progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "no-answer"
  | "busy"
  | "cancelled"
  | "canceled"
  | "voicemail"
  | string

export type Sentiment = "positive" | "neutral" | "negative" | string

/**
 * One turn of a call transcript. The provider shape varies, so every field is
 * optional and the renderer normalizes speaker/text/timestamp defensively.
 */
export type TranscriptTurn = {
  role?: string
  speaker?: string
  from?: string
  text?: string
  content?: string
  message?: string
  timestamp?: string | number
  ts?: string | number
  at?: string | number
  start?: number
  [key: string]: any
}

export type CallRow = {
  id: string
  direction: CallDirection
  status: CallStatus
  from_number: string | null
  to_number: string | null
  order_id: string | null
  customer_id: string | null
  disposition: string | null
  summary: string | null
  sentiment: Sentiment | null
  recording_url: string | null
  transcript: TranscriptTurn[] | null
  cost_total: number | null
  started_at: string | null
  ended_at: string | null
  provider_call_id: string | null
  playbook_id: string | null
  campaign_id?: string | null
  locale: string | null
}

/** A prior dial attempt for the same target (retry history). */
export type CallAttempt = {
  id: string
  status?: string | null
  disposition?: string | null
  started_at?: string | null
  ended_at?: string | null
  attempt_number?: number | null
  created_at?: string | null
  [key: string]: any
}

/**
 * A disposition entry. May be a plain string (applied code) or an object with a
 * code/label plus who/when it was set — rendered defensively either way.
 */
export type CallDisposition =
  | string
  | {
      id?: string
      code?: string
      label?: string
      value?: string
      note?: string | null
      created_at?: string | null
      created_by?: string | null
      [key: string]: any
    }

export type CallDetail = {
  call: CallRow
  dispositions: CallDisposition[]
  attempts: CallAttempt[]
}

/* ------------------------------------------------------------------ */
/* Medusa store types (subset for Customer-360)                        */
/* ------------------------------------------------------------------ */

export type AdminOrder = {
  id: string
  display_id?: number
  status?: string
  fulfillment_status?: string
  payment_status?: string
  email?: string | null
  currency_code?: string
  total?: number
  item_total?: number
  created_at?: string
  customer_id?: string | null
  items?: Array<{
    id: string
    title?: string
    product_title?: string
    variant_title?: string | null
    quantity?: number
    total?: number
    thumbnail?: string | null
  }>
  shipping_address?: AdminAddress | null
  [key: string]: any
}

export type AdminAddress = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
  company?: string | null
  [key: string]: any
}

export type AdminCustomer = {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company_name?: string | null
  has_account?: boolean
  created_at?: string
  orders?: Array<{
    id: string
    display_id?: number
    status?: string
    total?: number
    currency_code?: string
    created_at?: string
  }>
  addresses?: AdminAddress[]
  groups?: Array<{ id: string; name?: string }>
  metadata?: Record<string, any> | null
  [key: string]: any
}

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

export async function api<T = any>(
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
/* Calls                                                               */
/* ------------------------------------------------------------------ */

export function listCalls(params: {
  status?: string
  direction?: string
  order_id?: string
  campaign_id?: string
  limit?: number
  offset?: number
}): Promise<{ calls: CallRow[]; count: number; limit: number; offset: number }> {
  const qs = new URLSearchParams()
  if (params.status) qs.set("status", params.status)
  if (params.direction) qs.set("direction", params.direction)
  if (params.order_id) qs.set("order_id", params.order_id)
  if (params.campaign_id) qs.set("campaign_id", params.campaign_id)
  qs.set("limit", String(params.limit ?? 50))
  qs.set("offset", String(params.offset ?? 0))
  return api(`/admin/call-center/calls?${qs.toString()}`)
}

export function getCall(id: string): Promise<CallDetail> {
  return api(`/admin/call-center/calls/${id}`)
}

/* ------------------------------------------------------------------ */
/* Customer-360 (standard Medusa admin store API)                      */
/* ------------------------------------------------------------------ */

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "fulfillment_status",
  "payment_status",
  "email",
  "currency_code",
  "total",
  "item_total",
  "created_at",
  "customer_id",
  "*items",
  "*shipping_address",
].join(",")

const CUSTOMER_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "phone",
  "company_name",
  "has_account",
  "created_at",
  "metadata",
  "orders.id",
  "orders.display_id",
  "orders.status",
  "orders.total",
  "orders.currency_code",
  "orders.created_at",
  "*addresses",
  "groups.id",
  "groups.name",
].join(",")

export function getOrder(id: string): Promise<{ order: AdminOrder }> {
  return api(`/admin/orders/${id}?fields=${encodeURIComponent(ORDER_FIELDS)}`)
}

export function getCustomer(id: string): Promise<{ customer: AdminCustomer }> {
  return api(
    `/admin/customers/${id}?fields=${encodeURIComponent(CUSTOMER_FIELDS)}`
  )
}

/* ------------------------------------------------------------------ */
/* Formatting + display helpers                                        */
/* ------------------------------------------------------------------ */

export const CALL_STATUS_BADGE: Record<
  string,
  { label: string; color: "green" | "grey" | "orange" | "red" | "blue" | "purple" }
> = {
  queued: { label: "Queued", color: "grey" },
  ringing: { label: "Ringing", color: "blue" },
  in_progress: { label: "In progress", color: "blue" },
  "in-progress": { label: "In progress", color: "blue" },
  completed: { label: "Completed", color: "green" },
  failed: { label: "Failed", color: "red" },
  no_answer: { label: "No answer", color: "orange" },
  "no-answer": { label: "No answer", color: "orange" },
  busy: { label: "Busy", color: "orange" },
  cancelled: { label: "Cancelled", color: "grey" },
  canceled: { label: "Cancelled", color: "grey" },
  voicemail: { label: "Voicemail", color: "purple" },
}

export const SENTIMENT_BADGE: Record<
  string,
  { label: string; color: "green" | "grey" | "red" }
> = {
  positive: { label: "Positive", color: "green" },
  neutral: { label: "Neutral", color: "grey" },
  negative: { label: "Negative", color: "red" },
}

/** Title-case an unknown status/code for display when we have no explicit map. */
export function humanize(value?: string | null): string {
  if (!value) return "—"
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** mm:ss (or h:mm:ss) duration between two ISO timestamps. */
export function formatDuration(
  start?: string | null,
  end?: string | null
): string {
  if (!start || !end) return "—"
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "—"
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Cost as a currency string. cost_total is treated as a major-unit amount. */
export function formatCost(
  amount?: number | null,
  currency?: string | null
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—"
  const n = Number(amount)
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

/** Money for order totals (Medusa v2 amounts are major-unit decimals). */
export function formatMoney(
  amount?: number | null,
  currency?: string | null
): string {
  return formatCost(amount, currency)
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

/** Best-effort display name for a customer or address. */
export function fullName(
  first?: string | null,
  last?: string | null
): string {
  const name = [first, last].filter(Boolean).join(" ").trim()
  return name || "—"
}
