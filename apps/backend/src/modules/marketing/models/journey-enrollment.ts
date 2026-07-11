import { model } from "@medusajs/framework/utils"

/**
 * marketing_journey_enrollment — the claim-first work row: one contact's live
 * position in one journey. The runner sweeps rows whose `next_run_at <= now`,
 * claims them (status "processing"), executes the step at `step_index`, then
 * advances `step_index` + sets the next `next_run_at`, or completes/exits.
 * `context` carries per-enrollment data (cart_id, order_id, discount_code, …)
 * the steps read/write. Mirrors the publish runner + cart-recovery patterns.
 *
 * MULTI-TENANT: `tenant_id` scopes every row.
 */
const MarketingJourneyEnrollment = model
  .define("marketing_journey_enrollment", {
    id: model.id({ prefix: "mjenr" }).primaryKey(),
    tenant_id: model.text(),
    journey_id: model.text(),
    contact_id: model.text().nullable(),
    email: model.text().nullable(),
    customer_id: model.text().nullable(),
    step_index: model.number().default(0),
    status: model
      .enum([
        "active",
        "waiting",
        "processing",
        "completed",
        "canceled",
        "failed",
      ])
      .default("active"),
    next_run_at: model.dateTime().nullable(),
    attempts: model.number().default(0),
    max_attempts: model.number().default(3),
    /** Per-enrollment data the steps read/write (cart_id, order_id, codes…). */
    context: model.json().nullable(),
    error: model.text().nullable(),
    entered_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_journey_enrollment_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_journey_enrollment_tenant_status_next",
      on: ["tenant_id", "status", "next_run_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_journey_enrollment_journey_contact",
      on: ["tenant_id", "journey_id", "contact_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingJourneyEnrollment
