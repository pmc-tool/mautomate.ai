import { model } from "@medusajs/framework/utils"

/**
 * marketing_message — a single message within a marketing_conversation.
 *
 * `direction` records inbound vs outbound; `author` records who produced it
 * (contact / agent / ai / system). `body` and `media` hold the content;
 * `external_message_id` maps to the provider's own id and is partial-unique
 * (where present) so a redelivered webhook is idempotent. `delivery_status` and
 * `sent_at` track outbound delivery; the (tenant_id, conversation_id, sent_at)
 * index backs chronological thread reads.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingMessage = model
  .define("marketing_message", {
    id: model.id({ prefix: "mmsg" }).primaryKey(),
    tenant_id: model.text(),
    conversation_id: model.text(),
    direction: model.enum(["inbound", "outbound"]),
    author: model.enum(["contact", "agent", "ai", "system"]),
    body: model.text().nullable(),
    media: model.json().nullable(),
    external_message_id: model.text().nullable(),
    delivery_status: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_message_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_message_tenant_conversation_sent",
      on: ["tenant_id", "conversation_id", "sent_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_message_external_message_id_unique",
      on: ["tenant_id", "external_message_id"],
      unique: true,
      where: "external_message_id IS NOT NULL AND deleted_at IS NULL",
    },
  ])

export default MarketingMessage
