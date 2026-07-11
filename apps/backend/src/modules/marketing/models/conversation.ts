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
    ]),
    external_thread_id: model.text().nullable(),
    status: model.enum(["open", "snoozed", "closed"]).default("open"),
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
  ])

export default MarketingConversation
