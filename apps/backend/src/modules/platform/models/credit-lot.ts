import { model } from "@medusajs/framework/utils"

/**
 * credit_lot — one batch of credits as they ENTERED the wallet.
 *
 * The wallet's `balance` stays the fast atomic gate (a single number we can
 * conditionally decrement); lots are the allocation layer that answers "which
 * credits are these, and do they expire?".
 *
 *   plan  — the monthly allowance. Expires at period end (use it or lose it).
 *   topup — credits the merchant BOUGHT. Never expire. Burning money someone
 *           paid for is how you make merchants hate a platform.
 *   trial — the free grant. Expires when the trial does.
 *   grant — operator goodwill. Expiry optional.
 *
 * Invariant: wallet.balance == SUM(credit_lot.remaining) for a tenant.
 * Spending burns SOONEST-EXPIRING first, so paid credits are always consumed
 * last — the merchant-friendly order.
 */
const CreditLot = model
  .define("credit_lot", {
    id: model.id({ prefix: "clot" }).primaryKey(),
    tenant_id: model.text(),
    source: model.enum(["plan", "topup", "trial", "grant", "legacy"]).default("grant"),
    amount: model.number().default(0), // credits granted
    remaining: model.number().default(0), // credits left in this lot
    expires_at: model.dateTime().nullable(), // null = never expires
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_credit_lot_tenant_remaining",
      on: ["tenant_id", "remaining"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CreditLot
