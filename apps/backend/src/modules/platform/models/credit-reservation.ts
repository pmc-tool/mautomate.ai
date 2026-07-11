import { model } from "@medusajs/framework/utils"

/**
 * credit_reservation — an in-flight hold created by reserve(), resolved by
 * commit()/release(). Persisted so a crash between reserve and commit leaves a
 * durable record the reaper can release (TTL). `amount` is the reserved credits;
 * `status` transitions open → committed | released.
 */
const CreditReservation = model
  .define("credit_reservation", {
    id: model.id({ prefix: "cres" }).primaryKey(),
    tenant_id: model.text(),
    amount: model.number(),
    action: model.text().nullable(),
    status: model.enum(["open", "committed", "released"]).default("open"),
  })
  .indexes([
    {
      name: "IDX_credit_reservation_open",
      on: ["tenant_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CreditReservation
