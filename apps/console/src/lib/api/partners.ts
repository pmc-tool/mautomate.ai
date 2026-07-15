import { ApiError, request } from "@/lib/api"

export type PartnerTier = "bronze" | "silver" | "gold"
export type PartnerStatus = "active" | "inactive"

export type Partner = {
  id: string
  name: string
  email: string | null
  company: string | null
  tier: PartnerTier
  commission_pct: number
  status: PartnerStatus
  referral_code: string | null
}

export type PartnersResponse = {
  partners: Partner[]
}

export type PartnerInput = {
  name: string
  email?: string
  company?: string
  tier?: PartnerTier
  commission_pct?: number
  referral_code?: string
}

export type PartnerUpdateInput = {
  tier?: PartnerTier
  status?: PartnerStatus
  commission_pct?: number
  company?: string
  email?: string
}

export async function listPartners(token: string): Promise<PartnersResponse> {
  return request<PartnersResponse>("/admin/platform/partners", { token })
}

export async function createPartner(token: string, input: PartnerInput): Promise<Partner> {
  return request<Partner>("/admin/platform/partners", { method: "POST", token, body: input })
}

export async function updatePartner(
  token: string,
  id: string,
  input: PartnerUpdateInput
): Promise<Partner> {
  return request<Partner>(`/admin/platform/partners/${id}`, { method: "PUT", token, body: input })
}

export async function deletePartner(
  token: string,
  id: string
): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>(`/admin/platform/partners/${id}`, {
    method: "DELETE",
    token,
  })
}
