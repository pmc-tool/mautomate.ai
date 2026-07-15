import { ApiError, request } from "@/lib/api"

export type HealthCheck = {
  service: string
  ok: boolean
  detail?: string
}

export type DriftedWallet = {
  tenant_id: string
  drift: number
}

export type ProviderSeverity = "ok" | "warn" | "critical" | "unknown"

/** A vendor we resell, and whether it can actually serve right now. */
export type ProviderHealth = {
  service: string
  role: string
  ok: boolean
  severity: ProviderSeverity
  detail: string
  remaining?: { value: number; unit: string; percent?: number }
  single_point_of_failure?: boolean
}

export type Reconciliation = {
  wallets_checked: number
  tenants: number
  drifted: DriftedWallet[]
}

export type ObservabilityResponse = {
  health: HealthCheck[]
  providers: ProviderHealth[]
  provider_alerts: ProviderHealth[]
  reconciliation: Reconciliation
}

/**
 * `force` re-probes every vendor instead of serving the 60s cache. The probes
 * cost real vendor requests, so it is the refresh button — not the page load.
 */
export async function getObservability(
  token: string,
  force = false
): Promise<ObservabilityResponse> {
  return request<ObservabilityResponse>(
    `/admin/platform/observability${force ? "?force=1" : ""}`,
    { token }
  )
}
