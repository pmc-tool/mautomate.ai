import { model } from "@medusajs/framework/utils"

/**
 * credit_wallet — the per-tenant balance, in the CONTROL PLANE (authoritative).
 *
 * `balance` is spendable credits; `reserved` is credits held by in-flight
 * reservations (reserve → act → commit/release). Both are bigNumber so they are
 * EXACT — never a float. The real-time gate is an atomic conditional decrement
 * against `balance` (see CreditLedgerService); this row is the source of truth,
 * and tenant.credit_balance is only a display cache of it.
 */
const CreditWallet = model
  .define("credit_wallet", {
    id: model.id({ prefix: "cwal" }).primaryKey(),
    tenant_id: model.text(),
    balance: model.number().default(0),
    reserved: model.number().default(0),
    currency: model.text().default("credit"),
  })
  .indexes([
    {
      name: "IDX_credit_wallet_tenant_unique",
      on: ["tenant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CreditWallet
