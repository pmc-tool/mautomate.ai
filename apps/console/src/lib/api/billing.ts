import { ApiError, request } from "@/lib/api"

export type PaymentGateway = {
  name: "stripe" | "sslcommerz"
  configured: boolean
  serves_bd: boolean
}

export type BillingResponse = {
  mrr_usd: number
  topup_revenue_usd: number
  revenue_total_usd: number
  by_package: Record<string, number>
  gateways: PaymentGateway[]
  wired: boolean
}

export type IntegrationKeyResponse = {
  env: string
  configured: boolean
  source: "vault" | "env" | null
}

export type IntegrationTestResponse = {
  ok: boolean
  message: string
}

export async function getBilling(token: string): Promise<BillingResponse> {
  return request<BillingResponse>("/admin/platform/billing", { token })
}

export async function setIntegrationKey(
  token: string,
  env: string,
  value: string
): Promise<IntegrationKeyResponse> {
  return request<IntegrationKeyResponse>(`/admin/platform/integrations/${encodeURIComponent(env)}`, {
    method: "POST",
    token,
    body: { value },
  })
}

export async function clearIntegrationKey(
  token: string,
  env: string
): Promise<IntegrationKeyResponse> {
  return request<IntegrationKeyResponse>(`/admin/platform/integrations/${encodeURIComponent(env)}`, {
    method: "DELETE",
    token,
  })
}

export async function testIntegrationKey(
  token: string,
  env: string
): Promise<IntegrationTestResponse> {
  return request<IntegrationTestResponse>(`/admin/platform/integrations/${encodeURIComponent(env)}`, {
    method: "POST",
    token,
    body: { action: "test" },
  })
}
