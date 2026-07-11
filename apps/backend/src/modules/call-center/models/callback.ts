import { model } from "@medusajs/framework/utils"

/**
 * call_center_callback — a scheduled request to call a customer back.
 *
 * Captures who to reach (customer_id / order_id / phone), when (scheduled_at),
 * which playbook to run, and the lifecycle `status` (pending / done / canceled)
 * with an optional `reason`.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const Callback = model
  .define("call_center_callback", {
    id: model.id({ prefix: "callback" }).primaryKey(),
    tenant_id: model.text(),
    customer_id: model.text().nullable(),
    order_id: model.text().nullable(),
    phone: model.text().nullable(),
    playbook_id: model.text().nullable(),
    scheduled_at: model.dateTime(),
    status: model.enum(["pending", "done", "canceled"]).default("pending"),
    reason: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_callback_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Callback
