import { request } from "@/lib/api"

/**
 * One merchant's AI P&L in the selected window. `cost` is what the vendor billed
 * us (Langfuse, USD); `revenue_usd` is what we charged (usage_event credits *
 * CREDIT_USD); `margin_usd = revenue_usd - cost`; `margin_pct` is a FRACTION
 * (margin_usd / revenue_usd), null when revenue is 0.
 */
export type AiUsageMerchant = {
  tenant_id: string | null
  name: string
  cost: number
  traces: number
  tokens: number
  credits?: number
  revenue_usd?: number
  margin_usd?: number
  margin_pct?: number | null
}

export type AiUsageFeature = {
  feature: string
  cost: number
  traces: number
}

export type AiUsageModel = {
  model: string
  cost: number
  tokens: number
  traces: number
}

export type AiUsageRecent = {
  time: string
  name: string
  feature: string
  merchant: string
  model: string | null
  cost: number
}

/**
 * Platform-wide AI spend + P&L for a ?range window. Cost is aggregated from
 * Langfuse; revenue/margin from the trusted usage_event ledger (same source as
 * the Margin page).
 *
 * When Langfuse is down / unconfigured the backend returns `available: false`
 * (with a `reason`) but STILL fills revenue/margin from usage_event — so the
 * page can degrade to a revenue-only view rather than an error.
 */
export type AiUsageResponse = {
  available: boolean
  reason?: string
  range?: string
  window?: { from: string; to: string }
  total_cost?: number
  total_traces?: number
  total_tokens?: number
  total_revenue_usd?: number
  total_margin_usd?: number
  overall_margin_pct?: number | null
  by_merchant?: AiUsageMerchant[]
  by_feature?: AiUsageFeature[]
  by_model?: AiUsageModel[]
  recent?: AiUsageRecent[]
  truncated?: boolean
  note?: string
}

export async function getAiUsage(
  token: string,
  range = "7d"
): Promise<AiUsageResponse> {
  return request<AiUsageResponse>(
    `/admin/platform/ai-usage?range=${encodeURIComponent(range)}`,
    { token }
  )
}
