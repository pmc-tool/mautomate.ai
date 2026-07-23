/**
 * Partner panel API client. Same-origin: the edge proxies /partner/* and
 * /auth/* to the control-plane backend on the merchant hub host, so relative
 * URLs work wherever the panel is served.
 */

export class PartnerApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type PartnerProfile = {
  id: string
  name: string
  email: string | null
  company: string | null
  tier: "bronze" | "silver" | "gold"
  commission_pct: number
  referral_code: string | null
  payout_method: string | null
}

export type PartnerStats = {
  referred_stores: number
  active_stores: number
  pending_cents: number
  requested_cents: number
  paid_cents: number
  lifetime_cents: number
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
    created_at: string
  } | null
}

export type PartnerCommission = {
  id: string
  store: string
  source: "subscription" | "renewal" | "topup" | "manual"
  base_cents: number
  pct: number
  amount_cents: number
  status: "pending" | "paid" | "void"
  payout_id: string | null
  created_at: string
}

export type PartnerPayout = {
  id: string
  amount_cents: number
  status: "requested" | "paid" | "rejected"
  method: string | null
  note: string | null
  paid_at: string | null
  created_at: string
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return data?.message || fallback
  } catch {
    return fallback
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 401) {
    throw new PartnerApiError("Session expired. Please sign in again.", 401)
  }
  if (!res.ok) {
    throw new PartnerApiError(await errorMessage(res, "Request failed"), res.status)
  }
  return (await res.json()) as T
}

export async function partnerLogin(email: string, password: string): Promise<string> {
  const res = await fetch("/auth/partner/emailpass", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new PartnerApiError(
      await errorMessage(res, "Sign in failed — check your email and password."),
      res.status
    )
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new PartnerApiError("Sign in failed.", 500)
  return data.token
}

export async function getPartnerMe(token: string): Promise<{
  partner: PartnerProfile
  referral_link: string | null
  stats: PartnerStats
}> {
  return request("/partner/me", { token })
}

export async function listPartnerReferrals(
  token: string
): Promise<{ referrals: PartnerReferral[] }> {
  return request("/partner/referrals", { token })
}

export async function listPartnerCommissions(
  token: string
): Promise<{ commissions: PartnerCommission[]; count: number }> {
  return request("/partner/commissions", { token })
}

export async function listPartnerPayouts(token: string): Promise<{
  payouts: PartnerPayout[]
  requestable_cents: number
  min_cents: number
}> {
  return request("/partner/payouts", { token })
}

export async function requestPartnerPayout(
  token: string,
  method: string
): Promise<{ payout: PartnerPayout }> {
  return request("/partner/payouts", { method: "POST", token, body: { method } })
}

export async function updatePartnerProfile(
  token: string,
  body: { name?: string; company?: string | null; payout_method?: string | null }
): Promise<{ partner: PartnerProfile }> {
  return request("/partner/profile", { method: "PUT", token, body })
}

export function usd(cents: number | null | undefined): string {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}
