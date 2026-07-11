import { model } from "@medusajs/framework/utils"

/**
 * marketing_cart_recovery — the claim-first work row for abandoned-cart recovery.
 *
 * One row per recovered cart. A scheduled sweep enrolls stale carts (has email,
 * no order, idle past the threshold), then steps each through the 3-email
 * sequence: `step` advances 0→1→2→3, `next_run_at` is the due column the runner
 * claims on, and `status` tracks the outcome. `order.placed` for the cart flips
 * it to "recovered". Mirrors the publish runner's claim-first pattern; in Phase 3
 * this generalizes into the journey engine.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; `cart_id` is unique per tenant.
 */
const MarketingCartRecovery = model
  .define("marketing_cart_recovery", {
    id: model.id({ prefix: "mcrec" }).primaryKey(),
    tenant_id: model.text(),
    cart_id: model.text(),
    contact_id: model.text().nullable(),
    email: model.text(),
    customer_id: model.text().nullable(),
    step: model.number().default(0),
    status: model
      .enum(["active", "processing", "recovered", "completed", "canceled", "failed"])
      .default("active"),
    next_run_at: model.dateTime().nullable(),
    attempts: model.number().default(0),
    max_attempts: model.number().default(3),
    discount_code: model.text().nullable(),
    last_email_send_id: model.text().nullable(),
    cart_total: model.number().nullable(),
    currency_code: model.text().nullable(),
    recovered_at: model.dateTime().nullable(),
    error: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_cart_recovery_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_cart_recovery_cart_unique",
      on: ["tenant_id", "cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_cart_recovery_tenant_status_next",
      on: ["tenant_id", "status", "next_run_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingCartRecovery
