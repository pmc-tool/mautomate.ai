import { ApiError, request } from "@/lib/api"

export type InfraInstance = {
  tenant: string
  slug: string
  status: string
  backend_url: string | null
  container_ref: string | null
  db_name: string | null
}

export type InfraJob = {
  id: string
  tenant: string
  status: string
  current_step: string | null
  attempts: number
  at: Date | string
}

export type InfraResponse = {
  provisioner: string
  instances: InfraInstance[]
  jobs: InfraJob[]
}

export async function getInfra(token: string): Promise<InfraResponse> {
  return request<InfraResponse>("/admin/platform/infra", { token })
}
