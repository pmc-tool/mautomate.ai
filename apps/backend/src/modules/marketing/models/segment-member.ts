import { model } from "@medusajs/framework/utils"

/**
 * marketing_segment_member — a contact's materialized membership in a segment.
 * Dynamic segments rebuild this set on each evaluation; static segments manage
 * it by hand. (segment_id, contact_id) is unique per tenant.
 *
 * MULTI-TENANT: `tenant_id` scopes every row.
 */
const MarketingSegmentMember = model
  .define("marketing_segment_member", {
    id: model.id({ prefix: "msegm" }).primaryKey(),
    tenant_id: model.text(),
    segment_id: model.text(),
    contact_id: model.text(),
    source: model.enum(["dynamic", "manual"]).default("dynamic"),
    added_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_segment_member_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_segment_member_seg_contact_unique",
      on: ["tenant_id", "segment_id", "contact_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_segment_member_segment",
      on: ["tenant_id", "segment_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSegmentMember
