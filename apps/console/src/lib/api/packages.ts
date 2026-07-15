import { ApiError, request } from "@/lib/api"

export type Package = {
  id: string
  key: string
  name: string
  price_usd: number
  included_credits: number
  fixed_infra_usd: number
  products_limit: number | null
  seats_limit: number | null
  domains_limit: number | null
  features: string[] | null
  active: boolean
  sort: number
  created_at: string
  updated_at: string
}

export type PricebookEntry = {
  action: string
  credits: number
  vendor_cost_usd: number
}

export type PricingResponse = {
  tiers: Package[]
  price_book: Record<string, PricebookEntry> | null
  credit_usd: number
}

export type CreatePackageInput = {
  key: string
  name: string
  price_usd: number
  included_credits: number
  fixed_infra_usd: number
  products_limit?: number | null
  seats_limit?: number | null
  domains_limit?: number | null
  features?: string[] | null
  active?: boolean
  sort?: number
}

export type UpdatePackageInput = Partial<CreatePackageInput>

export async function getPricing(token: string): Promise<PricingResponse> {
  return request<PricingResponse>("/admin/platform/pricing", { token })
}

export async function createPackage(
  token: string,
  input: CreatePackageInput
): Promise<{ package: Package }> {
  return request<{ package: Package }>("/admin/platform/packages", {
    method: "POST",
    token,
    body: input,
  })
}

export async function updatePackage(
  token: string,
  key: string,
  input: UpdatePackageInput
): Promise<{ package: Package }> {
  return request<{ package: Package }>(`/admin/platform/packages/${encodeURIComponent(key)}`, {
    method: "PUT",
    token,
    body: input,
  })
}

export async function deletePackage(token: string, key: string): Promise<void> {
  await request<void>(`/admin/platform/packages/${encodeURIComponent(key)}`, {
    method: "DELETE",
    token,
  })
}

export async function updatePricebook(
  token: string,
  action: string,
  credits: number,
  vendor_cost_usd: number
): Promise<void> {
  await request<void>(`/admin/platform/pricebook/${encodeURIComponent(action)}`, {
    method: "PUT",
    token,
    body: { credits, vendor_cost_usd },
  })
}
