import { model } from "@medusajs/framework/utils"

/**
 * ads_rule — one autopilot rule: WHEN a metric crosses a threshold over a
 * window, DO an action. Evaluated by the autopilot sweep against stored
 * ads_insight aggregates; every firing is written to ads_action_log with
 * actor "autopilot" and the numbers that triggered it.
 *
 * `campaign_id` null = the rule watches every active campaign. `min_spend`
 * stops a rule from judging a campaign before it has spent enough to judge.
 * `cooldown_hours` prevents flapping. Money is MAJOR units.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsRule = model
  .define("ads_rule", {
    id: model.id({ prefix: "adrule" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    enabled: model.boolean().default(true),
    campaign_id: model.text().nullable(),
    metric: model.enum(["spend", "cpa", "ctr", "clicks", "conversions"]),
    op: model.enum(["gt", "lt"]),
    value: model.float(),
    window_days: model.float().default(3),
    min_spend: model.float().default(0),
    action: model.enum(["pause_campaign", "notify"]),
    cooldown_hours: model.float().default(24),
    last_fired_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_rule_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsRule
