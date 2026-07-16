import { model } from "@medusajs/framework/utils"

/**
 * ads_action_log — the audit trail of everything that touches a merchant's
 * advertising: who acted (merchant / ai / autopilot / system), what they did,
 * why, and the before/after snapshot. The campaign detail page renders this as
 * the "AI actions timeline"; it is the guardrail that makes automated media
 * buying accountable. Rows are append-only — nothing updates or deletes them.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const AdsActionLog = model
  .define("ads_action_log", {
    id: model.id({ prefix: "adlog" }).primaryKey(),
    tenant_id: model.text(),
    actor: model.enum(["merchant", "ai", "autopilot", "system"]),
    action: model.text(),
    level: model.text().nullable(),
    object_id: model.text().nullable(),
    external_id: model.text().nullable(),
    reason: model.text().nullable(),
    before: model.json().nullable(),
    after: model.json().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_ads_action_log_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_ads_action_log_tenant_object",
      on: ["tenant_id", "object_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AdsActionLog
