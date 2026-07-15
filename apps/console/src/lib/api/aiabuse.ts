import { ApiError, request } from "@/lib/api"

export type AiProvider = {
  name: string
  category: string
  configured: boolean
}

export type AbuseQuota = {
  per_ip_per_hour: number
  global_per_hour: number
  window_hours: number
}

export type AiAbuseResponse = {
  ai: AiProvider[]
  signup_open: boolean
  quota: AbuseQuota
}

export async function getAiAbuse(token: string): Promise<AiAbuseResponse> {
  return request<AiAbuseResponse>("/admin/platform/abuse", { token })
}
