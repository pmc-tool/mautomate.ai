import { model } from "@medusajs/framework/utils"

/**
 * usage_event — the metered-action record behind a credit spend (for per-tenant
 * cost dashboards + nightly credit-vs-vendor reconciliation). One row per billed
 * action: the action key, measured units, credits charged, and the reservation
 * it committed against.
 */
const UsageEvent = model
  .define("usage_event", {
    id: model.id({ prefix: "uevt" }).primaryKey(),
    tenant_id: model.text(),
    action: model.text(), // e.g. ai_call_minute, sms_segment, ai_image
    units: model.number().default(1),
    credits: model.number().default(0),
    reservation_id: model.text().nullable(),
    vendor_cost_usd: model.number().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_usage_event_tenant_action",
      on: ["tenant_id", "action"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default UsageEvent
