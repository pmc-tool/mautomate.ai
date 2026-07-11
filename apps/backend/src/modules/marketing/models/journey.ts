import { model } from "@medusajs/framework/utils"

/**
 * marketing_journey — a reusable automation graph. A `trigger_event` (a commerce
 * event or "manual"/"segment") enrolls matching contacts, who are then stepped
 * through `steps` — an ordered JSON array of typed nodes (wait / condition /
 * action) — by the journey runner. `segment_filter` optionally narrows who
 * enrolls. The shipped cart-recovery flow is the first thing this generalizes.
 *
 * MULTI-TENANT: `tenant_id` scopes every row.
 */
const MarketingJourney = model
  .define("marketing_journey", {
    id: model.id({ prefix: "mjrny" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    /** e.g. "order.placed", "cart.updated", "customer.created", "manual", "segment". */
    trigger_event: model.text(),
    /** Optional trigger tuning (e.g. { min_total: 100 }). */
    trigger_config: model.json().nullable(),
    /** Optional segment id or inline filter that narrows enrollment. */
    segment_id: model.text().nullable(),
    segment_filter: model.json().nullable(),
    /** Ordered array of JourneyStep nodes (see journey/types.ts). */
    steps: model.json().nullable(),
    status: model
      .enum(["draft", "active", "paused", "archived"])
      .default("draft"),
    /** Whether a contact can be enrolled more than once. */
    allow_reenroll: model.boolean().default(false),
    stats: model.json().nullable(),
    brand_voice_id: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_journey_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_journey_tenant_trigger_status",
      on: ["tenant_id", "trigger_event", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingJourney
