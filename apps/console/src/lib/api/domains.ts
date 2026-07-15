import { ApiError, request } from "@/lib/api"

export type DomainType = "free" | "custom"

export type Domain = {
  id: string
  domain: string
  tenant: string
  type: DomainType
  is_primary: boolean
  ssl_status: string
  verification_status: string
}

export type DomainsResponse = {
  domains: Domain[]
}

export async function listDomains(token: string): Promise<DomainsResponse> {
  return request<DomainsResponse>("/admin/platform/domains", { token })
}
