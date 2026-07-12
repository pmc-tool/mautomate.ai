import { model } from "@medusajs/framework/utils"

/**
 * marketing_conversation — an inbox thread with a contact on a single channel.
 *
 * Groups messages exchanged with a `contact_id` over one `channel`. `status`
 * drives the inbox workflow (open / snoozed / closed); `assigned_user_id` and
 * `agent_id` route the thread to a human or AI agent. `external_thread_id` maps
 * the thread to the provider's own conversation id and is partial-unique per
 * (tenant_id, channel) so an inbound webhook resolves to exactly one thread.
 * `last_message_at`, `unread_count`, and `starred` back the inbox list view.
 *
 * AI-vs-HUMAN STATE MACHINE: `handler_mode` says who currently owns the thread —
 * `ai` (the bot answers), `queued` (handoff requested, waiting for a human to
 * pick it up), `human` (a human has taken over and the bot stays silent).
 * `handoff_reason` records why the bot escalated. `chatbot_id` binds the thread
 * to the marketing_chatbot that answers it (its persona + knowledge).
 *
 * The `voice` channel lets a completed call-center call surface as a thread in
 * the unified inbox alongside the messaging channels.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingConversation = model
  .define("marketing_conversation", {
    id: model.id({ prefix: "mconv" }).primaryKey(),
    tenant_id: model.text(),
    contact_id: model.text().nullable(),
    channel: model.enum([
      "whatsapp",
      "messenger",
      "telegram",
      "instagram",
      "web_widget",
      "email",
      "review",
      "voice",
    ]),
    external_thread_id: model.text().nullable(),
    status: model.enum(["open", "snoozed", "closed"]).default("open"),
    handler_mode: model.enum(["ai", "queued", "human"]).default("ai"),
    handoff_reason: model.text().nullable(),
    chatbot_id: model.text().nullable(),
    assigned_user_id: model.text().nullable(),
    agent_id: model.text().nullable(),
    last_message_at: model.dateTime().nullable(),
    unread_count: model.number().default(0),
    starred: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_marketing_conversation_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_conversation_tenant_status_last_message",
      on: ["tenant_id", "status", "last_message_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_conversation_tenant_channel_thread_unique",
      on: ["tenant_id", "channel", "external_thread_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      // Backs the inbox's "needs a human" view: the queued/human buckets are
      // read far more often than they are written.
      name: "IDX_marketing_conversation_tenant_handler_mode",
      on: ["tenant_id", "handler_mode", "last_message_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingConversation
