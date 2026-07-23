import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { resolveMerchant } from "../_helpers"
import {
  ensureMerchantReferralCode,
  REFEREE_BONUS_CREDITS,
  REFERRER_REWARD_CREDITS,
} from "../../../modules/platform/partners/merchant-referral"

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/**
 * GET /merchant/referrals — the merchant's "Refer & earn" data: their code +
 * share link (lazily generated on first visit), program terms, stats, and the
 * stores they referred. Rewards are wallet credits (internal spend only).
 *
 * Response: { code, link, program, stats, referrals }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const svc: any = req.scope.resolve(PLATFORM_MODULE)

  const code = await ensureMerchantReferralCode(svc, ctx.merchant)

  const referrals = await svc.listMerchantReferrals(
    { referrer_tenant_id: ctx.tenant.id },
    { take: 500, order: { created_at: "DESC" } }
  )

  const tenantIds = (referrals || []).map((r: any) => r.referred_tenant_id)
  const tenants = tenantIds.length
    ? await svc.listTenants({ id: tenantIds }, { take: 500 }).catch(() => [])
    : []
  const byId = new Map((tenants || []).map((t: any) => [t.id, t]))

  const rewarded = (referrals || []).filter((r: any) => r.status === "rewarded")

  res.json({
    code,
    link: `https://${ROOT}/signup?ref=${code}`,
    program: {
      referee_bonus_credits: REFEREE_BONUS_CREDITS,
      referrer_reward_credits: REFERRER_REWARD_CREDITS,
    },
    stats: {
      referred: (referrals || []).length,
      rewarded: rewarded.length,
      credits_earned: rewarded.reduce(
        (a: number, r: any) => a + (Number(r.reward_credits) || 0),
        0
      ),
    },
    referrals: (referrals || []).map((r: any) => {
      const t: any = byId.get(r.referred_tenant_id)
      return {
        id: r.id,
        store_name: t?.name || t?.slug || "New store",
        status: r.status,
        reward_credits: r.reward_credits,
        referred_at: r.created_at,
        rewarded_at: r.rewarded_at,
      }
    }),
  })
}
