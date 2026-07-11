import { model } from "@medusajs/framework/utils"

/**
 * call_center_campaign — an orchestrated batch of outbound calls.
 *
 * Defines the audience (audience_filter), when it runs (schedule / cadence),
 * pacing (concurrency / daily_cap), the driving playbook, and the caller id
 * (from_number). `status` tracks the campaign lifecycle.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const Campaign = model
  .define("call_center_campaign", {
    id: model.id({ prefix: "campaign" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    status: model
      .enum([
        "draft",
        "scheduled",
        "running",
        "paused",
        "completed",
        "canceled",
      ])
      .default("draft"),
    playbook_id: model.text().nullable(),
    audience_filter: model.json().nullable(),
    schedule: model.json().nullable(),
    cadence: model.json().nullable(),
    concurrency: model.number().default(5),
    daily_cap: model.number().nullable(),
    from_number: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_campaign_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Campaign
