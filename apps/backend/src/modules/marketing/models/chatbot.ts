import { model } from "@medusajs/framework/utils"
import MarketingChatbotData from "./chatbot-data"

/**
 * marketing_chatbot — a public-facing conversational bot bound to an agent.
 *
 * `name`/`greeting` present it, `agent_id` binds it to the MarketingAgent that
 * powers replies, `channel_config` holds per-channel wiring, `public_key` is the
 * embed/identify token, and `reply_mode` gates whether replies are drafted for
 * review or sent automatically. Its knowledge sources live in `data`
 * (marketing_chatbot_data).
 *
 * The partial-unique (public_key) index (where deleted_at IS NULL) gives at most
 * one live bot per public key.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingChatbot = model
  .define("marketing_chatbot", {
    id: model.id({ prefix: "mbot" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    greeting: model.text().nullable(),
    agent_id: model.text().nullable(),
    channel_config: model.json().nullable(),
    public_key: model.text().nullable(),
    reply_mode: model.enum(["draft", "auto"]).default("draft"),
    active: model.boolean().default(true),
    data: model.hasMany(() => MarketingChatbotData, { mappedBy: "chatbot" }),
  })
  .indexes([
    {
      name: "IDX_marketing_chatbot_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_chatbot_public_key_unique",
      on: ["public_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingChatbot
