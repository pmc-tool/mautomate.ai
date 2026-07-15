import { ApiError, request } from "@/lib/api"

export type IntegrationProvider = {
  key: string
  name: string
  category: string
  configured: boolean
  testable: boolean
  source: "vault" | "env" | null
  scope: string
  status: "configured" | "missing" | "error" | string
  last_tested_at?: string | null
  /** One-line guidance: where to get this key. */
  help?: string | null
  /** Deep link to the provider's developer console / docs. */
  docs?: string | null
  /** Whether the value is a secret (mask the input). */
  secret?: boolean
  /** For social/messaging: the OAuth redirect URI / webhook URL to register. */
  connect_url?: string | null
}

export type IntegrationsResponse = {
  providers: IntegrationProvider[]
}

export type IntegrationTestResponse = {
  ok: boolean
  message?: string
}

export async function listIntegrations(
  token: string
): Promise<IntegrationsResponse> {
  const res = await request<{ providers: Array<Omit<IntegrationProvider, "key"> & { env: string }> }>(
    "/admin/platform/integrations",
    { token }
  )
  return {
    providers: res.providers.map((p) => ({
      ...p,
      key: p.env,
      status: p.configured ? "configured" : "missing",
    })),
  }
}

export async function setIntegrationKey(
  token: string,
  env: string,
  value: string
): Promise<void> {
  await request<void>(`/admin/platform/integrations/${env}`, {
    method: "POST",
    token,
    body: { value },
  })
}

export async function clearIntegrationKey(
  token: string,
  env: string
): Promise<void> {
  await request<void>(`/admin/platform/integrations/${env}`, {
    method: "DELETE",
    token,
  })
}

export async function testIntegration(
  token: string,
  env: string
): Promise<IntegrationTestResponse> {
  return request<IntegrationTestResponse>(`/admin/platform/integrations/${env}`, {
    method: "POST",
    token,
    body: { action: "test" },
  })
}
