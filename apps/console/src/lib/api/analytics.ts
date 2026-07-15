import { request } from "@/lib/api"

export type PlatformSite = {
  id: string
  name: string
  domain: string
  pageviews: number
  visitors: number
  visits: number
}

export type PlatformAnalytics = {
  enabled: boolean
  range?: string
  site_count?: number
  totals?: { pageviews: number; visitors: number; visits: number } | null
  websites?: PlatformSite[]
}

export async function getPlatformAnalytics(
  token: string,
  range = "7d"
): Promise<PlatformAnalytics> {
  return request<PlatformAnalytics>(
    `/admin/platform/analytics?range=${encodeURIComponent(range)}`,
    { token }
  )
}
