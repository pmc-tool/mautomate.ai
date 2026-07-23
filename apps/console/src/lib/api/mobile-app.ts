import { request } from "@/lib/api"

export type MobileAppKind = "build" | "publish"
export type MobileAppTier = "play" | "full" | null

export type MobileAppBuildStatus =
  | "queued"
  | "building"
  | "ready"
  | "failed"
export type MobileAppPublishStatus =
  | "paid"
  | "in_progress"
  | "published"
  | "cancelled"
export type MobileAppStatus = MobileAppBuildStatus | MobileAppPublishStatus | string

export type MobileAppConfigSnapshot = {
  app_name?: string | null
  icon_url?: string | null
  accent?: string | null
} | null

export type MobileAppOrder = {
  id: string
  tenant_id: string | null
  store_name: string
  kind: MobileAppKind
  tier: MobileAppTier
  regular_price_usd: number | null
  expected_amount_usd: number | null
  amount_paid_usd: number | null
  status: MobileAppStatus
  download_url: string | null
  config_snapshot: MobileAppConfigSnapshot
  created_at: string
}

export type MobileAppOrderDetail = MobileAppOrder & {
  stripe_event_id: string | null
  meta: Record<string, unknown> | null
  updated_at: string
}

export type MobileAppOrdersResponse = {
  orders: MobileAppOrder[]
  count: number
}

/** Valid lifecycle statuses per kind — kept in sync with the backend route. */
export const MOBILE_APP_STATUSES: Record<MobileAppKind, string[]> = {
  build: ["queued", "building", "ready", "failed"],
  publish: ["paid", "in_progress", "published", "cancelled"],
}

export async function listMobileAppOrders(
  token: string,
  params?: { status?: string; kind?: string }
): Promise<MobileAppOrdersResponse> {
  const search = new URLSearchParams()
  if (params?.status) search.set("status", params.status)
  if (params?.kind) search.set("kind", params.kind)
  const qs = search.toString()
  return request<MobileAppOrdersResponse>(
    `/admin/platform/mobile-app-orders${qs ? `?${qs}` : ""}`,
    { token }
  )
}

export async function getMobileAppOrder(
  token: string,
  id: string
): Promise<{ order: MobileAppOrderDetail }> {
  return request<{ order: MobileAppOrderDetail }>(
    `/admin/platform/mobile-app-orders/${encodeURIComponent(id)}`,
    { token }
  )
}

export async function setMobileAppDownload(
  token: string,
  id: string,
  download_url: string
): Promise<{ id: string; download_url: string; status: string }> {
  return request<{ id: string; download_url: string; status: string }>(
    `/admin/platform/mobile-app-orders/${encodeURIComponent(id)}`,
    {
      method: "POST",
      token,
      body: { action: "set_download", download_url },
    }
  )
}

export async function setMobileAppStatus(
  token: string,
  id: string,
  status: string
): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(
    `/admin/platform/mobile-app-orders/${encodeURIComponent(id)}`,
    {
      method: "POST",
      token,
      body: { action: "set_status", status },
    }
  )
}
