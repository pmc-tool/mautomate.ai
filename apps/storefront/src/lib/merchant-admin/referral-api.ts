import { ApiError, apiUrl } from "./api"

/** Merchant "Refer & earn" API client (/merchant/referrals). */

export type MerchantReferralRow = {
  id: string
  store_name: string
  status: "signed_up" | "rewarded"
  reward_credits: number
  referred_at: string
  rewarded_at: string | null
}

export type MerchantReferralsResponse = {
  code: string
  link: string
  program: {
    referee_bonus_credits: number
    referrer_reward_credits: number
  }
  stats: {
    referred: number
    rewarded: number
    credits_earned: number
  }
  referrals: MerchantReferralRow[]
}

export async function getMerchantReferrals(
  token: string
): Promise<MerchantReferralsResponse> {
  const res = await fetch(apiUrl("/merchant/referrals"), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (!res.ok) {
    let message = "Failed to load referrals"
    try {
      const data = await res.json()
      message = data?.message || message
    } catch {}
    throw new ApiError(message, res.status)
  }
  return (await res.json()) as MerchantReferralsResponse
}
