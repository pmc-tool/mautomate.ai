import { model } from "@medusajs/framework/utils"

/**
 * marketing_stat — a captured metric datapoint for a marketing subject.
 *
 * A narrow time-series fact row: `subject_type` + `subject_id` identify what was
 * measured (a post target, conversation, campaign, agent, or post), `platform`
 * optionally narrows the source, `metric` names the measure (impressions, reach,
 * ... , revenue), and `value` holds the reading at `captured_at`. The
 * (tenant_id, subject_type, subject_id, captured_at) index backs per-subject
 * time-series reads.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingStat = model
  .define("marketing_stat", {
    id: model.id({ prefix: "mstat" }).primaryKey(),
    tenant_id: model.text(),
    subject_type: model.enum([
      "post_target",
      "conversation",
      "campaign",
      "agent",
      "post",
    ]),
    subject_id: model.text(),
    platform: model.text().nullable(),
    metric: model.enum([
      "impressions",
      "reach",
      "likes",
      "comments",
      "shares",
      "clicks",
      "replies",
      "conversions",
      "revenue",
    ]),
    value: model.number().default(0),
    captured_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_stat_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_stat_tenant_subject_captured",
      on: ["tenant_id", "subject_type", "subject_id", "captured_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingStat
