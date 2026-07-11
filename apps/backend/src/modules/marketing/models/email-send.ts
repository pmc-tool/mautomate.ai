import { model } from "@medusajs/framework/utils"

/**
 * marketing_email_send — one email dispatched to one recipient, with its
 * delivery + engagement state machine. This is the per-send audit + tracking
 * row: `token` is the opaque id embedded in the open pixel / click / unsubscribe
 * URLs (all first-party on the store domain), and the timestamps/counters record
 * engagement fed back by those routes and provider bounce webhooks.
 *
 * status: queued → sending → sent → (delivered) → opened → clicked, or
 *         bounced / complained / failed / suppressed.
 *
 * MULTI-TENANT: `tenant_id` scopes every row. `token` is globally unique.
 */
const MarketingEmailSend = model
  .define("marketing_email_send", {
    id: model.id({ prefix: "mesend" }).primaryKey(),
    tenant_id: model.text(),
    contact_id: model.text().nullable(),
    template_id: model.text().nullable(),
    journey_enrollment_id: model.text().nullable(),
    campaign_id: model.text().nullable(),
    to_email: model.text(),
    subject: model.text().nullable(),
    status: model
      .enum([
        "queued",
        "sending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
        "failed",
        "suppressed",
      ])
      .default("queued"),
    token: model.text(),
    provider: model.text().nullable(),
    external_message_id: model.text().nullable(),
    error: model.text().nullable(),
    open_count: model.number().default(0),
    click_count: model.number().default(0),
    sent_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    opened_at: model.dateTime().nullable(),
    clicked_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_email_send_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_email_send_token_unique",
      on: ["token"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_email_send_tenant_contact",
      on: ["tenant_id", "contact_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_email_send_tenant_status",
      on: ["tenant_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingEmailSend
