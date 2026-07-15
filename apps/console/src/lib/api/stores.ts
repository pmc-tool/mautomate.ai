import { ApiError, request } from "@/lib/api"

export type StoreStatus = "live" | "suspended" | "provisioning" | string

export type Store = {
  id: string
  name: string
  slug: string
  subdomain?: string
  package: string
  status: StoreStatus
  credit_balance: number
  store_url?: string
  admin_url?: string
  merchant_login_url?: string
  publishable_key?: string
}

export type StoresResponse = {
  tenants: Store[]
}

export type StoreSubscription = {
  package_key: string
  price_usd: number
  billing_cycle: string
  next_billing_at?: string | null
}

export type StoreDetail = Store & {
  email?: string
  owner_name?: string
  subscription?: StoreSubscription | null
}

export type StoreDomain = {
  id: string
  domain: string
  is_primary: boolean
  ssl_status: string
}

export type StoreWallet = {
  credit_balance: number
  credits_spent?: number
} | null

export type StoreDetailResponse = {
  tenant: StoreDetail
  domains: StoreDomain[]
  wallet: StoreWallet
  usage_by_action: Record<string, number>
  audit: unknown[]
}

export type ProvisionInput = {
  slug: string
  name?: string
  admin_email?: string
  admin_password?: string
  owner_name?: string
  trial_credits?: number
  package?: string
}

export type ProvisionResponse = {
  tenant: Store
  merchant: {
    id: string
    email: string
    password: string
  }
}

export type ImpersonateResponse = {
  tenant_id: string
  store_url: string
  token?: string
  scope: string
  expires_in?: number
  backend_url?: string
}

export type MerchantLogin = {
  id: string
  email: string
  name?: string
  tenant_id?: string
  created_at: string
}

export type MerchantLoginsResponse = {
  logins: MerchantLogin[]
}

export type CreateMerchantLoginInput = {
  email: string
  password: string
  name?: string
}

export type CreateMerchantLoginResponse = {
  merchant: MerchantLogin
}

export async function listStores(token: string): Promise<StoresResponse> {
  return request<StoresResponse>("/admin/platform/tenants", { token })
}

export async function getStore(
  token: string,
  id: string,
  signal?: AbortSignal
): Promise<StoreDetailResponse> {
  return request<StoreDetailResponse>(`/admin/platform/tenants/${id}`, { token, signal })
}

export async function provisionStore(
  token: string,
  input: ProvisionInput
): Promise<ProvisionResponse> {
  return request<ProvisionResponse>("/admin/platform/provision", {
    method: "POST",
    token,
    body: input,
  })
}

export async function deleteStore(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}`, { method: "DELETE", token })
}

export async function suspendStore(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/suspend`, { method: "POST", token })
}

export async function resumeStore(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/resume`, { method: "POST", token })
}

export async function setStorePlan(
  token: string,
  id: string,
  key: string,
  grantIncluded = false
): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/plan`, {
    method: "POST",
    token,
    body: { key, grant_included: grantIncluded },
  })
}

export async function grantCredits(
  token: string,
  id: string,
  amount: number
): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/credits`, {
    method: "POST",
    token,
    body: { amount },
  })
}

export async function impersonateStore(
  token: string,
  id: string
): Promise<ImpersonateResponse> {
  return request<ImpersonateResponse>(`/admin/platform/tenants/${id}/impersonate`, {
    method: "POST",
    token,
  })
}

export async function listMerchantLogins(
  token: string,
  id: string,
  signal?: AbortSignal
): Promise<MerchantLoginsResponse> {
  // The backend returns { merchants: [...] }; the console model uses `logins`.
  const res = await request<{ merchants?: MerchantLogin[] }>(
    `/admin/platform/tenants/${id}/merchant`,
    { token, signal }
  )
  return { logins: res.merchants ?? [] }
}

export async function createMerchantLogin(
  token: string,
  id: string,
  input: CreateMerchantLoginInput
): Promise<CreateMerchantLoginResponse> {
  return request<CreateMerchantLoginResponse>(`/admin/platform/tenants/${id}/merchant`, {
    method: "POST",
    token,
    body: input,
  })
}
