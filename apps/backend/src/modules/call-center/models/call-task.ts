import { model } from "@medusajs/framework/utils"

/**
 * call_center_call_task — a unit of outbound (or inbound-callback) work to be
 * dialed by a worker.
 *
 * The claim-first sweep picks due tasks by (tenant_id, status, scheduled_at),
 * claims one, then dials. Retry bookkeeping lives here (attempts / max_attempts
 * / next_retry_at); a task terminates as `done`, `failed`, or `canceled`.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. The composite
 * (tenant_id, status, scheduled_at) index backs the claim-first sweep.
 */
const CallTask = model
  .define("call_center_call_task", {
    id: model.id({ prefix: "ctask" }).primaryKey(),
    tenant_id: model.text(),
    order_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    playbook_id: model.text().nullable(),
    direction: model.enum(["inbound", "outbound"]).default("outbound"),
    status: model
      .enum([
        "scheduled",
        "claimed",
        "in_progress",
        "done",
        "failed",
        "canceled",
      ])
      .default("scheduled"),
    scheduled_at: model.dateTime(),
    attempts: model.number().default(0),
    max_attempts: model.number().default(3),
    next_retry_at: model.dateTime().nullable(),
    campaign_id: model.text().nullable(),
    locale: model.text().nullable(),
    priority: model.number().default(0),
  })
  .indexes([
    {
      name: "IDX_call_center_call_task_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Backs the claim-first sweep: due tasks per tenant by status + schedule.
      name: "IDX_call_center_call_task_claim_sweep",
      on: ["tenant_id", "status", "scheduled_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallTask
