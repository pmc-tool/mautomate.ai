import { ApiError, request, type Metrics, type Tenant } from "@/lib/api"

export type CreditsMetricsResponse = {
  metrics: Metrics
}

export type TenantCreditsResponse = {
  tenant_id: string
  balance: number
}

export type TenantsResponse = {
  tenants: Tenant[]
}

export async function getPlatformMetrics(token: string): Promise<CreditsMetricsResponse> {
  return request<CreditsMetricsResponse>("/admin/platform/metrics", { token })
}

export async function listPlatformTenants(token: string): Promise<TenantsResponse> {
  return request<TenantsResponse>("/admin/platform/tenants", { token })
}

export type CreditBreakdown = {
  tenant_id: string
  total: number
  expiring: number
  permanent: number
  next_expiry: string | null
}

/** Where granted credits come from — decides whether they can ever expire. */
export type GrantSource = "grant" | "topup" | "plan" | "trial"

export async function getTenantCreditBreakdown(
  token: string,
  id: string
): Promise<CreditBreakdown> {
  return request<CreditBreakdown>(`/admin/platform/tenants/${id}/credits`, { token })
}

export async function grantTenantCredits(
  token: string,
  id: string,
  amount: number,
  opts: { source?: GrantSource; expires_in_days?: number; reason?: string } = {}
): Promise<TenantCreditsResponse> {
  return request<TenantCreditsResponse>(`/admin/platform/tenants/${id}/credits`, {
    method: "POST",
    token,
    body: {
      amount,
      source: opts.source ?? "grant",
      expires_in_days: opts.expires_in_days ?? 0,
      reason: opts.reason,
    },
  })
}
