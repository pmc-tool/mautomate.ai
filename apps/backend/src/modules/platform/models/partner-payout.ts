import { model } from "@medusajs/framework/utils"

/**
 * partner_payout — a partner's request to be paid their pending commission
 * balance. Requesting bundles the open pending commissions (their payout_id is
 * stamped); the operator then marks the payout paid (commissions -> paid) or
 * rejected (commissions released back to pending). Amounts are integer cents.
 */
const PartnerPayout = model
  .define("partner_payout", {
    id: model.id({ prefix: "prtpay" }).primaryKey(),
    partner_id: model.text(),
    amount_cents: model.number().default(0),
    status: model.enum(["requested", "paid", "rejected"]).default("requested"),
    method: model.text().nullable(),
    note: model.text().nullable(),
    paid_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_partner_payout_partner",
      on: ["partner_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default PartnerPayout
