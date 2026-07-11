import { model } from "@medusajs/framework/utils"
import Call from "./call"

/**
 * call_center_call_attempt — a single dial attempt belonging to a Call.
 *
 * Each redial of a Call produces one attempt row (attempt_number, outcome,
 * cost, timing). `call_task_id` links back to the originating work item
 * (call_center_call_task) when the attempt came from a scheduled task.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const CallAttempt = model
  .define("call_center_call_attempt", {
    id: model.id({ prefix: "cattempt" }).primaryKey(),
    tenant_id: model.text(),
    attempt_number: model.number(),
    outcome: model.text().nullable(),
    cost: model.number().default(0),
    started_at: model.dateTime().nullable(),
    ended_at: model.dateTime().nullable(),
    call_task_id: model.text().nullable(),
    call: model.belongsTo(() => Call, { mappedBy: "attempts" }),
  })
  .indexes([
    {
      name: "IDX_call_center_call_attempt_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallAttempt
