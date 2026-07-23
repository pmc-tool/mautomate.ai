import crypto from "crypto"
import { PLATFORM_MODULE } from ".."
import { getLedger } from "../credits/metering"

/**
 * Merchant-refers-merchant referral program ("Give 200, get 500").
 *
 * Business rules (deliberate, anti-abuse first):
 *  - The REFEREE (new store) gets a small welcome bonus at signup — it expires,
 *    so farmed signups can't stockpile value.
 *  - The REFERRER earns their reward ONLY when the referred store makes its
 *    FIRST real payment (subscription or top-up via the Stripe webhook) — a
 *    signup alone pays nothing, so throwaway-store farming is worthless.
 *  - One reward EVER per referred store (ledger idempotency key), one
 *    attribution EVER per store (unique referred_tenant_id; partner referral
 *    codes take precedence and exclude merchant attribution).
 *  - Self-referral (same email or same tenant) is silently ignored.
 *  - Rewards are wallet CREDITS — internal purchases only, never payable out.
 */

export const REFEREE_BONUS_CREDITS = 200
export const REFEREE_BONUS_EXPIRY_DAYS = 30
export const REFERRER_REWARD_CREDITS = 500

/** Uppercase-alnum code (fits the signup ref sanitizer: <=10 chars, A-Z0-9). */
function generateCode(): string {
  return (
    "R" +
    crypto
      .randomBytes(8)
      .toString("base64")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 7)
  )
}

/**
 * Ensure the merchant has a referral code, generating + persisting one on
 * first use. Codes are globally unique across merchants AND never collide
 * with a partner code (partners are checked first at signup anyway, but a
 * collision would shadow the merchant's code — so avoid minting one).
 */
export async function ensureMerchantReferralCode(
  svc: any,
  merchant: any
): Promise<string> {
  if (merchant.referral_code) return merchant.referral_code as string
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const [merchantClash] = await svc.listMerchants(
      { referral_code: code },
      { take: 1 }
    )
    const [partnerClash] = await svc.listPartners(
      { referral_code: code },
      { take: 1 }
    )
    if (merchantClash || partnerClash) continue
    await svc.updateMerchants({ id: merchant.id, referral_code: code })
    return code
  }
  throw new Error("could not generate a unique referral code")
}

/**
 * Attribute a signup's ?ref code. Partner codes win (the partner program pays
 * cash commissions and is operator-managed); otherwise a merchant referral is
 * recorded and the referee's welcome bonus granted. Best-effort by contract:
 * callers must never let attribution failure fail a signup.
 */
export async function attributeSignupReferral(
  scope: { resolve: (key: string) => any },
  args: { code: string; tenantId: string; email?: string | null }
): Promise<{ kind: "partner" | "merchant" } | null> {
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const code = args.code

  // 1. Partner program first.
  const [partner] = await svc.listPartners(
    { referral_code: code, status: "active" },
    { take: 1 }
  )
  if (partner) {
    await svc.createPartnerReferrals([
      { partner_id: partner.id, tenant_id: args.tenantId, code_used: code },
    ])
    return { kind: "partner" }
  }

  // 2. Merchant referral.
  const [referrer] = await svc.listMerchants(
    { referral_code: code, status: "active" },
    { take: 1 }
  )
  if (!referrer) return null

  // Self-referral guards: same account email or same store.
  const email = (args.email ?? "").trim().toLowerCase()
  if (email && String(referrer.email ?? "").toLowerCase() === email) return null
  if (referrer.tenant_id === args.tenantId) return null

  await svc.createMerchantReferrals([
    {
      referrer_tenant_id: referrer.tenant_id,
      referrer_merchant_id: referrer.id,
      referred_tenant_id: args.tenantId,
      code_used: code,
      status: "signed_up",
      referee_bonus_credits: REFEREE_BONUS_CREDITS,
    },
  ])

  // Referee welcome bonus — expiring grant, idempotent per referred store.
  const ledger = getLedger(scope as any)
  await ledger
    .credit(args.tenantId, REFEREE_BONUS_CREDITS, {
      type: "grant",
      source: "grant",
      expiresAt: new Date(Date.now() + REFEREE_BONUS_EXPIRY_DAYS * 864e5),
      idempotencyKey: `mref-bonus:${args.tenantId}`,
      meta: {
        reason: "referral_welcome_bonus",
        description: "Welcome bonus — referred by another store",
        referred_by_tenant: referrer.tenant_id,
      },
    })
    .catch(() => undefined)

  return { kind: "merchant" }
}

/**
 * Reward the referrer once the referred store pays real money for the first
 * time. Called (best-effort) from the Stripe webhook money sites — internally
 * a no-op unless a not-yet-rewarded merchant referral exists for the payer.
 * The ledger idempotency key makes the grant once-EVER even across retries.
 */
export async function grantMerchantReferralReward(
  scope: { resolve: (key: string) => any },
  args: { tenantId: string; sourceRef?: string | null }
): Promise<number | null> {
  if (!args.tenantId) return null
  const svc: any = scope.resolve(PLATFORM_MODULE)

  const [referral] = await svc.listMerchantReferrals(
    { referred_tenant_id: args.tenantId },
    { take: 1 }
  )
  if (!referral || referral.status === "rewarded") return null

  const referrerMerchant = await svc
    .retrieveMerchant(referral.referrer_merchant_id)
    .catch(() => null)
  if (!referrerMerchant || referrerMerchant.status !== "active") return null

  const ledger = getLedger(scope as any)
  await ledger.credit(referral.referrer_tenant_id, REFERRER_REWARD_CREDITS, {
    type: "grant",
    source: "grant",
    // Earned by delivering a paying customer — never expires.
    expiresAt: null,
    idempotencyKey: `mref-reward:${args.tenantId}`,
    meta: {
      reason: "referral_reward",
      description: "Referral reward — your referred store made its first payment",
      referred_tenant: args.tenantId,
      event: args.sourceRef ?? null,
    },
  })

  await svc.updateMerchantReferrals({
    id: referral.id,
    status: "rewarded",
    reward_credits: REFERRER_REWARD_CREDITS,
    rewarded_at: new Date(),
  })

  return REFERRER_REWARD_CREDITS
}
