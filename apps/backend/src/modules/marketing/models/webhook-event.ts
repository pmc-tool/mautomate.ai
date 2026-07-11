import { model } from "@medusajs/framework/utils"

/**
 * marketing_webhook_event — an idempotency ledger for inbound provider webhooks.
 *
 * Each incoming webhook is recorded by its provider-assigned `external_event_id`
 * (partial-unique while live) so replays are dropped exactly-once. `channel`
 * names the source, `payload` stores the raw body for reprocessing, and
 * `processed_at` marks when the event was successfully handled.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingWebhookEvent = model
  .define("marketing_webhook_event", {
    id: model.id({ prefix: "mwh" }).primaryKey(),
    tenant_id: model.text(),
    channel: model.text(),
    external_event_id: model.text(),
    payload: model.json().nullable(),
    processed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_webhook_event_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_webhook_event_external_event_id_unique",
      on: ["tenant_id", "external_event_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingWebhookEvent
