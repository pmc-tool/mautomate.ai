import { model } from "@medusajs/framework/utils"

/**
 * marketing_chatbot_channel — binds one chatbot to one channel it serves.
 *
 * A THIN BINDING ONLY, deliberately: it says "bot X answers channel Y, using the
 * connected account Z". It holds NO SECRETS — access tokens and every other
 * credential stay in marketing_social_credential, reachable via
 * `social_account_id` (a marketing_social_account id). `config` carries only
 * non-secret per-channel settings (e.g. widget placement, greeting overrides).
 *
 * `active` lets a merchant mute a bot on one channel without unbinding it. The
 * unique (tenant_id, chatbot_id, channel) index means a bot serves a given
 * channel at most once, so inbound routing resolves deterministically.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingChatbotChannel = model
  .define("marketing_chatbot_channel", {
    id: model.id({ prefix: "mbotch" }).primaryKey(),
    tenant_id: model.text(),
    chatbot_id: model.text(),
    channel: model.enum([
      "web_widget",
      "whatsapp",
      "messenger",
      "instagram",
      "telegram",
    ]),
    social_account_id: model.text().nullable(),
    active: model.boolean().default(true),
    config: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_chatbot_channel_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_chatbot_channel_tenant_bot_channel_unique",
      on: ["tenant_id", "chatbot_id", "channel"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingChatbotChannel
