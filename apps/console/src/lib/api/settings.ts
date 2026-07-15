import { ApiError, request } from "@/lib/api"

export type PlatformSettings = {
  root_domain: string
  provisioner_mode: string
  platform_enabled: boolean
  signup_open: boolean
  encryption_key_set: boolean
  webhook_master_set: boolean
  superadmins: number
  node_env: string
  file_provider: string
}

export async function getSettings(token: string): Promise<PlatformSettings> {
  return request<PlatformSettings>("/admin/platform/settings", { token })
}
