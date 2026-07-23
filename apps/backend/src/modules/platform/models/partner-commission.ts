import { model } from "@medusajs/framework/utils"

/**
 * partner_commission — the APPEND-ONLY partner earnings ledger.
 *
 * One row per commissionable money-in event of a referred store (subscription
 * start, monthly renewal, credit top-up — accrued from the Stripe webhook, or
 * "manual" operator adjustments). Amounts are integer CENTS (exact, no float
 * drift). `source_ref` carries the Stripe event idempotency key with a partial
 * unique index, so a retried webhook can never double-accrue.
 *
 * Lifecycle: pending -> (payout requested: payout_id set) -> paid | void.
 */
const PartnerCommission = model
  .define("partner_commission", {
    id: model.id({ prefix: "prtcom" }).primaryKey(),
    partner_id: model.text(),
    tenant_id: model.text(),
    source: model.enum(["subscription", "renewal", "topup", "manual"]),
    source_ref: model.text().nullable(),
    base_cents: model.number().default(0),
    pct: model.number().default(0),
    amount_cents: model.number().default(0),
    status: model.enum(["pending", "paid", "void"]).default("pending"),
    payout_id: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_partner_commission_source_unique",
      on: ["source_ref"],
      unique: true,
      where: "deleted_at IS NULL AND source_ref IS NOT NULL",
    },
    {
      name: "IDX_partner_commission_partner",
      on: ["partner_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default PartnerCommission
