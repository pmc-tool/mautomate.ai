/**
 * AI Call Center — admin Campaigns data layer (Phase 4).
 *
 * Thin typed wrappers over /admin/call-center/campaigns|calls (cookie-session
 * auth via credentials:"include"). Every helper returns parsed JSON or throws an
 * Error carrying the backend's friendly `message` so callers can
 * `toast.error(e.message)`.
 *
 * This file is NOT a route — the admin router only registers `page.tsx` files,
 * so a plain `lib.ts` next to them is import-only (mirrors cms/pages/lib.ts).
 */

/* ------------------------------------------------------------------ */
/* Types (mirror the call_center_campaign / call_center_call contract) */
/* ------------------------------------------------------------------ */

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "canceled"

/**
 * Structured audience targeting stored in `audience_filter` (json). The backend
 * treats this as opaque json; the admin builder writes/reads this shape.
 */
export type AudienceFilter = {
  payment_status?: string | null
  created_after?: string | null
  region?: string | null
  limit?: number | null
} | null

/**
 * A daily calling window stored in `schedule` (json). Opaque to the backend.
 */
export type CampaignSchedule = {
  start_time?: string | null
  end_time?: string | null
  timezone?: string | null
} | null

export type Campaign = {
  id: string
  tenant_id?: string
  name: string
  status: CampaignStatus
  playbook_id: string | null
  audience_filter: AudienceFilter
  schedule: CampaignSchedule
  cadence: Record<string, any> | null
  concurrency: number
  daily_cap: number | null
  from_number: string | null
  created_at: string
  updated_at: string
}

export type CampaignCreateInput = {
  name: string
  playbook_id: string
  audience_filter?: AudienceFilter
  schedule?: CampaignSchedule
  cadence?: Record<string, any> | null
  concurrency?: number
  daily_cap?: number | null
  from_number?: string | null
}

export type CampaignUpdateInput = Partial<
  Omit<CampaignCreateInput, "playbook_id">
> & {
  status?: CampaignStatus
}

/** One call row (subset of call_center_call the console cares about). */
export type CallRow = {
  id: string
  status: string
  direction: string
  disposition: string | null
  campaign_id: string | null
  to_number: string | null
  summary: string | null
  sentiment: string | null
  cost_total?: number
  attempts?: { id: string }[]
  started_at: string | null
  ended_at: string | null
  created_at: string
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
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export function listCampaigns(params: {
  status?: CampaignStatus | ""
  limit?: number
  offset?: number
}): Promise<{
  campaigns: Campaign[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params.status) qs.set("status", params.status)
  qs.set("limit", String(params.limit ?? 50))
  qs.set("offset", String(params.offset ?? 0))
  return api(`/admin/call-center/campaigns?${qs.toString()}`)
}

export function createCampaign(
  body: CampaignCreateInput
): Promise<{ campaign: Campaign }> {
  return api(`/admin/call-center/campaigns`, { method: "POST", json: body })
}

export function getCampaign(id: string): Promise<{ campaign: Campaign }> {
  return api(`/admin/call-center/campaigns/${id}`)
}

/** Update a campaign (name/pacing/targeting and/or a validated status change). */
export function updateCampaign(
  id: string,
  body: CampaignUpdateInput
): Promise<{ campaign: Campaign }> {
  return api(`/admin/call-center/campaigns/${id}`, { method: "POST", json: body })
}

/* ------------------------------------------------------------------ */
/* Calls (for live outcome counters on the campaign detail page)       */
/* ------------------------------------------------------------------ */

export function listCallsForCampaign(
  campaignId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ calls: CallRow[]; count: number; limit: number; offset: number }> {
  const qs = new URLSearchParams()
  qs.set("campaign_id", campaignId)
  qs.set("limit", String(params?.limit ?? 200))
  qs.set("offset", String(params?.offset ?? 0))
  return api(`/admin/call-center/calls?${qs.toString()}`)
}

/* ------------------------------------------------------------------ */
/* Status model + presentation helpers                                 */
/* ------------------------------------------------------------------ */

export const STATUS_BADGE: Record<
  CampaignStatus,
  { label: string; color: "green" | "grey" | "orange" | "blue" | "red" }
> = {
  draft: { label: "Draft", color: "grey" },
  scheduled: { label: "Scheduled", color: "blue" },
  running: { label: "Running", color: "green" },
  paused: { label: "Paused", color: "orange" },
  completed: { label: "Completed", color: "grey" },
  canceled: { label: "Canceled", color: "red" },
}

/**
 * Client-side mirror of the backend's ALLOWED_TRANSITIONS map so the detail page
 * only offers valid actions. The server re-validates every transition (422/400).
 */
export const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["scheduled", "canceled"],
  scheduled: ["running", "paused", "canceled"],
  running: ["paused", "completed", "canceled"],
  paused: ["running", "completed", "canceled"],
  completed: [],
  canceled: [],
}

/** Friendly action definitions keyed by the target status. */
export const TRANSITION_ACTION: Record<
  CampaignStatus,
  { label: string; variant: "primary" | "secondary" | "danger" }
> = {
  scheduled: { label: "Schedule", variant: "secondary" },
  running: { label: "Start / Resume", variant: "primary" },
  paused: { label: "Pause", variant: "secondary" },
  completed: { label: "Complete", variant: "secondary" },
  canceled: { label: "Cancel", variant: "danger" },
  draft: { label: "Draft", variant: "secondary" },
}

export const formatDate = (iso?: string | null): string => {
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
