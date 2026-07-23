import { model } from "@medusajs/framework/utils"

/**
 * merchant_referral — merchant-refers-merchant ("Give 200, get 500").
 *
 * One row per REFERRED tenant (unique — a store can only ever be referred
 * once, by a merchant OR a partner, never both). Created at signup when the
 * ?ref code resolves to a merchant's referral_code. The referee's welcome
 * bonus is granted immediately; the referrer's reward is granted ONCE, when
 * the referred store makes its first real payment (status -> "rewarded").
 * All rewards are wallet CREDITS — internal spend only, never payable out.
 */
const MerchantReferral = model
  .define("merchant_referral", {
    id: model.id({ prefix: "mref" }).primaryKey(),
    referrer_tenant_id: model.text(),
    referrer_merchant_id: model.text(),
    referred_tenant_id: model.text(),
    code_used: model.text().nullable(),
    status: model.enum(["signed_up", "rewarded"]).default("signed_up"),
    referee_bonus_credits: model.number().default(0),
    reward_credits: model.number().default(0),
    rewarded_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_merchant_referral_referred_unique",
      on: ["referred_tenant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_merchant_referral_referrer",
      on: ["referrer_tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MerchantReferral
