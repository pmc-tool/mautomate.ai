import { model } from "@medusajs/framework/utils"

/**
 * marketing_segment — a saved audience. `dynamic` segments are rule-based
 * (`filter` is a rule tree re-evaluated on a schedule → materialized members);
 * `static` segments hold a hand-picked member set. Journeys can enroll from a
 * segment; the audience preview + counts read materialized members.
 *
 * MULTI-TENANT: `tenant_id` scopes every row.
 */
const MarketingSegment = model
  .define("marketing_segment", {
    id: model.id({ prefix: "mseg" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    kind: model.enum(["dynamic", "static"]).default("dynamic"),
    /** Rule tree: { match: "all"|"any", rules: SegmentRule[] } (see segment/types.ts). */
    filter: model.json().nullable(),
    member_count: model.number().default(0),
    last_evaluated_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_segment_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSegment
