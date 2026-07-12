import { model } from "@medusajs/framework/utils"
import MarketingChatbotData from "./chatbot-data"

/**
 * marketing_chatbot — a public-facing conversational bot.
 *
 * `name`/`greeting` present it, `channel_config` holds per-channel wiring,
 * `public_key` is the embed/identify token, and `reply_mode` gates whether
 * replies are drafted for review or sent automatically. Its knowledge sources
 * live in `data` (marketing_chatbot_data) and their embedded chunks in
 * marketing_knowledge_chunk (owner_id = this bot's id).
 *
 * PERSONA/BEHAVIOR: `instructions` is the system prompt that shapes the bot,
 * `dont_go_beyond` forces answers to stay inside the trained knowledge (refuse
 * rather than improvise), `language` pins the reply language, `welcome_message`
 * opens the thread and `bubble_message` is the teaser shown on the closed widget.
 *
 * APPEARANCE: `avatar`, `color`, `position`, `show_logo`, `show_datetime`,
 * `embed_width`/`embed_height` drive the embeddable widget's rendering.
 *
 * FEATURE TOGGLES: `collect_email`, `allow_attachments`, `allow_emoji`.
 *
 * TRAINING: `training_status` reflects the embedding pipeline for this bot's
 * sources (not_trained / training / trained); per-source status lives on
 * marketing_chatbot_data.
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
    /**
     * @deprecated DEAD FIELD - do not read or write (A-6).
     *
     * This used to bind a chatbot to a MarketingAgent that supplied its persona.
     * The chatbot now carries its OWN persona (`instructions`, `dont_go_beyond`,
     * `language`, ...) and the live reply path
     * (modules/marketing/messaging/ai-reply.ts + auto-reply.ts) never looks at
     * this column. Every code path that read or wrote it has been removed.
     *
     * The column is kept only because dropping it would need a migration; it is
     * always null for chatbots created from the merchant Chatbot Studio. Do not
     * reintroduce it.
     */
    agent_id: model.text().nullable(),
    channel_config: model.json().nullable(),
    public_key: model.text().nullable(),
    reply_mode: model.enum(["draft", "auto"]).default("draft"),
    active: model.boolean().default(true),
    instructions: model.text().nullable(),
    dont_go_beyond: model.boolean().default(false),
    language: model.text().nullable(),
    welcome_message: model.text().nullable(),
    bubble_message: model.text().nullable(),
    avatar: model.text().nullable(),
    color: model.text().default("#017BE5"),
    position: model.enum(["left", "right"]).default("right"),
    show_logo: model.boolean().default(true),
    show_datetime: model.boolean().default(true),
    embed_width: model.number().default(420),
    embed_height: model.number().default(745),
    collect_email: model.boolean().default(true),
    allow_attachments: model.boolean().default(true),
    allow_emoji: model.boolean().default(true),
    training_status: model
      .enum(["not_trained", "training", "trained"])
      .default("not_trained"),
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
