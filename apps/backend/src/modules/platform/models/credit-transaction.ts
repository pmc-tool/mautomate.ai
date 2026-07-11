import { model } from "@medusajs/framework/utils"

/**
 * credit_transaction — the APPEND-ONLY credit ledger (money of record).
 *
 * Every reserve / commit / release / grant / topup / refund / clawback is a
 * distinct immutable row, so the wallet balance is auditable and reconstructable.
 * `idempotency_key` collapses duplicate webhooks/retries; `reservation_id` links
 * a reserve to its later commit/release. `balance_after` snapshots the wallet
 * balance for audit. Amounts are bigNumber (exact), signed by intent.
 */
const CreditTransaction = model
  .define("credit_transaction", {
    id: model.id({ prefix: "ctxn" }).primaryKey(),
    tenant_id: model.text(),
    type: model.enum([
      "grant",
      "topup",
      "reserve",
      "commit",
      "release",
      "refund",
      "clawback",
      "adjust",
    ]),
    amount: model.number(),
    balance_after: model.number().nullable(),
    reservation_id: model.text().nullable(),
    idempotency_key: model.text().nullable(),
    action: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_credit_txn_idem_unique",
      on: ["tenant_id", "idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL AND idempotency_key IS NOT NULL",
    },
    {
      name: "IDX_credit_txn_reservation",
      on: ["reservation_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_credit_txn_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CreditTransaction
