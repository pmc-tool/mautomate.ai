import { model } from "@medusajs/framework/utils"

/**
 * partner_referral — links a tenant (store) to the partner who referred it.
 * One row per tenant (a store can only ever be referred once); created at
 * signup when a valid ?ref=CODE is presented, or attached manually by the
 * operator from the console. Every commission accrual resolves through this.
 */
const PartnerReferral = model
  .define("partner_referral", {
    id: model.id({ prefix: "prtref" }).primaryKey(),
    partner_id: model.text(),
    tenant_id: model.text(),
    code_used: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_partner_referral_tenant_unique",
      on: ["tenant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_partner_referral_partner",
      on: ["partner_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default PartnerReferral
