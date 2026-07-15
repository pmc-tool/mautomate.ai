import { request } from "@/lib/api"

/** Real P&L — computed from usage rows that carry BOTH credits charged and vendor cost. */
export type MarginActionRow = {
  action: string
  events: number
  units: number
  credits: number
  revenue_usd: number
  cost_usd: number
  profit_usd: number
  margin_pct: number | null
  multiple: number | null
  list_credits: number | null
}

export type MarginResponse = {
  window_days: number
  tenant_id: string | null
  revenue: {
    mrr_usd: number
    topup_credits_sold: number
    topup_usd_est: number
    usage_delivered_usd: number
  }
  cogs: { vendor_usd: number }
  gross: { profit_usd: number; margin_pct: number | null }
  by_action: MarginActionRow[]
  by_plan: { plan: string; tenants: number; mrr_usd: number }[]
}

export async function getMargin(
  token: string,
  opts: { days?: number; tenant_id?: string } = {}
): Promise<MarginResponse> {
  const q = new URLSearchParams()
  if (opts.days) q.set("days", String(opts.days))
  if (opts.tenant_id) q.set("tenant_id", opts.tenant_id)
  const qs = q.toString()
  return request<MarginResponse>(`/admin/platform/margin${qs ? `?${qs}` : ""}`, { token })
}
