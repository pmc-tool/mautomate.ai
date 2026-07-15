export type LoginInput = { email: string; password: string }

export type TenantStatus = "live" | "suspended" | "provisioning" | string

export type Tenant = {
  id: string
  name: string
  slug: string
  package: string
  status: TenantStatus
  credit_balance: number
}

export type Metrics = {
  tenants_total: number
  by_status: Record<string, number>
  by_package: Record<string, number>
  mrr_usd: number
  topup_revenue_usd: number
  revenue_total_usd: number
  credits_granted: number
  credits_spent: number
  credits_outstanding: number
  usage_by_action: Record<string, number>
}

export type MetricsResponse = {
  metrics: Metrics
}

export type TenantsResponse = {
  tenants: Tenant[]
}

export class ApiError extends Error {
  status: number
  type?: string
  constructor(message: string, status: number, type?: string) {
    super(message)
    this.status = status
    this.type = type
  }
}

export async function request<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { token?: string; body?: unknown }
): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string>),
  }
  if (init?.token) {
    headers["authorization"] = `Bearer ${init.token}`
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("b2d:session-expired"))
    }
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({} as any))
    throw new ApiError(
      data.message || "Access denied.",
      403,
      data.type || "forbidden"
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed")
    throw new ApiError(text || `Request failed (${res.status})`, res.status)
  }

  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    return (await res.json()) as T
  }
  return {} as T
}

export async function loginControl(input: LoginInput): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/user/emailpass", {
    method: "POST",
    body: input,
  })
}

export async function getMetrics(token: string): Promise<MetricsResponse> {
  return request<MetricsResponse>("/admin/platform/metrics", { token })
}

export async function listTenants(token: string): Promise<TenantsResponse> {
  return request<TenantsResponse>("/admin/platform/tenants", { token })
}

export async function suspendTenant(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/suspend`, {
    method: "POST",
    token,
    body: { reason: "abuse" },
  })
}

export async function resumeTenant(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}/resume`, {
    method: "POST",
    token,
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

export async function deleteTenant(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/tenants/${id}`, {
    method: "DELETE",
    token,
  })
}
