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

export type PartnerReferral = {
  id: string
  tenant_id: string
  code_used: string | null
  referred_at: string
  store: {
    name: string
    slug: string
    status: string
    package: string
  } | null
}

export type PartnerCommission = {
  id: string
  tenant_id: string
  source: string
  base_cents: number
  pct: number
  amount_cents: number
  status: string
  payout_id: string | null
  created_at: string
}

export type PartnerPayoutStatus = "requested" | "paid" | "rejected"

export type PartnerPayout = {
  id: string
  amount_cents: number
  status: PartnerPayoutStatus
  method: string | null
  note: string | null
  paid_at: string | null
  created_at: string
}

export type PartnerPayoutRequest = {
  id: string
  partner_id: string
  partner_name: string
  partner_email: string | null
  amount_cents: number
  method: string | null
  created_at: string
}

export type PartnerPayoutRequestsResponse = {
  requests: PartnerPayoutRequest[]
  count: number
}

export type PartnerTotals = {
  pending_cents: number
  paid_cents: number
  lifetime_cents: number
}

export type PartnerOverviewResponse = {
  partner: Partner
  referrals: PartnerReferral[]
  commissions: PartnerCommission[]
  payouts: PartnerPayout[]
  totals: PartnerTotals
}

export type PartnerCredentialsResponse = {
  email: string
  password: string
  panel_url: string
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

export async function getPartnerOverview(
  token: string,
  id: string
): Promise<PartnerOverviewResponse> {
  return request<PartnerOverviewResponse>(`/admin/platform/partners/${id}/overview`, { token })
}

export async function setPartnerCredentials(
  token: string,
  id: string,
  input: { password?: string } = {}
): Promise<PartnerCredentialsResponse> {
  return request<PartnerCredentialsResponse>(`/admin/platform/partners/${id}/credentials`, {
    method: "POST",
    token,
    body: input,
  })
}

export async function attachPartnerReferral(
  token: string,
  id: string,
  input: { slug?: string; tenant_id?: string }
): Promise<{ referral: PartnerReferral }> {
  return request<{ referral: PartnerReferral }>(`/admin/platform/partners/${id}/referrals`, {
    method: "POST",
    token,
    body: input,
  })
}

export async function listPayoutRequests(
  token: string
): Promise<PartnerPayoutRequestsResponse> {
  return request<PartnerPayoutRequestsResponse>("/admin/platform/partners/payout-requests", {
    token,
  })
}

export async function settlePartnerPayout(
  token: string,
  id: string,
  payoutId: string,
  input: { status: "paid" | "rejected"; note?: string }
): Promise<{ payout: PartnerPayout }> {
  return request<{ payout: PartnerPayout }>(`/admin/platform/partners/${id}/payouts/${payoutId}`, {
    method: "PUT",
    token,
    body: input,
  })
}
