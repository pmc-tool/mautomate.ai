import { model } from "@medusajs/framework/utils"

/**
 * marketing_schedule — a reusable posting cadence that maps time `slots` to
 * platforms within a timezone.
 *
 * The scheduler reads active schedules to place posts into upcoming slots,
 * optionally restricted by `platform_filter`. Inactive schedules are ignored.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingSchedule = model
  .define("marketing_schedule", {
    id: model.id({ prefix: "msched" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    timezone: model.text().default("UTC"),
    slots: model.json().nullable(),
    platform_filter: model.json().nullable(),
    active: model.boolean().default(true),
  })
  .indexes([
    {
      name: "IDX_marketing_schedule_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSchedule
