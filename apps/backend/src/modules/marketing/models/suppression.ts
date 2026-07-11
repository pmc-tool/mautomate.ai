import { model } from "@medusajs/framework/utils"

/**
 * marketing_suppression — the do-not-email list. Every marketing send checks
 * this first; an address here is skipped (status "suppressed"). Populated by
 * one-click unsubscribes, hard bounces, and spam complaints (provider webhooks),
 * plus manual additions.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; (tenant_id, email) is unique.
 */
const MarketingSuppression = model
  .define("marketing_suppression", {
    id: model.id({ prefix: "msupp" }).primaryKey(),
    tenant_id: model.text(),
    email: model.text(),
    reason: model
      .enum(["unsubscribe", "bounce", "complaint", "manual"])
      .default("unsubscribe"),
    source: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_suppression_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_suppression_tenant_email_unique",
      on: ["tenant_id", "email"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingSuppression
