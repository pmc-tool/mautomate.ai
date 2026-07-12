/**
 * Shared tenant/chatbot resolution for the PUBLIC web-chat API
 * (`/marketing-chat/*`). The `_` prefix keeps Medusa's file-based router from
 * mounting this as a route.
 *
 * TENANT RESOLUTION (the whole point of this file): these endpoints are public
 * and anonymous, so the tenant can NEVER come from env — it is derived from data
 * the caller presents:
 *
 *   /config, /session  ->  the chatbot's `public_key` (the embed token; public
 *                          by design, unique per bot) -> marketing_chatbot ->
 *                          its `tenant_id`.
 *   /message, /messages ->  the opaque `conversation_token` minted by /session,
 *                          which IS the conversation's `external_thread_id` on
 *                          channel "web_widget" -> the conversation row -> its
 *                          `tenant_id` (and its bound `chatbot_id`).
 *
 * Both lookups FAIL CLOSED: an unknown/inactive public key or an unknown token
 * yields null and the route answers 404. No fallback tenant, ever.
 */

import type { MedusaRequest } from "@medusajs/framework/http"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/** The public key travels in the body, the query, or the `x-chatbot-key` header. */
export const readPublicKey = (req: MedusaRequest<any>): string => {
  const fromBody =
    req.body && typeof (req.body as any).public_key === "string"
      ? (req.body as any).public_key
      : ""
  const fromQuery =
    typeof req.query?.public_key === "string" ? req.query.public_key : ""
  const headerRaw = req.headers["x-chatbot-key"]
  const fromHeader = typeof headerRaw === "string" ? headerRaw : ""
  return (fromBody || fromQuery || fromHeader).trim()
}

/**
 * Resolve the ACTIVE chatbot behind a public key. Returns null for an unknown
 * key, an inactive bot, or (defensively) an ambiguous match — the caller must
 * answer 404 so an attacker learns nothing about which keys exist.
 */
export const resolveChatbotByPublicKey = async (
  mk: any,
  publicKey: string
): Promise<any | null> => {
  if (!publicKey) {
    return null
  }
  let rows: any[] = []
  try {
    rows = await mk.listMarketingChatbots({ public_key: publicKey }, { take: 2 })
  } catch {
    return null
  }
  if (!Array.isArray(rows) || rows.length !== 1) {
    return null
  }
  const bot = rows[0]
  if (!bot?.active || !bot?.tenant_id) {
    return null
  }
  return bot
}

/**
 * Resolve the conversation behind a widget token. The token is globally unique
 * (24 random bytes), so it identifies exactly one thread WITHOUT a tenant hint —
 * and the row it resolves to carries the authoritative `tenant_id`. A token from
 * tenant A can therefore only ever reach tenant A's conversation.
 */
export const resolveConversationByToken = async (
  mk: any,
  token: string
): Promise<any | null> => {
  if (!token) {
    return null
  }
  let rows: any[] = []
  try {
    rows = await mk.listMarketingConversations(
      { channel: "web_widget", external_thread_id: token },
      { take: 2 }
    )
  } catch {
    return null
  }
  if (!Array.isArray(rows) || rows.length !== 1) {
    return null
  }
  const conversation = rows[0]
  return conversation?.tenant_id ? conversation : null
}

/** The PUBLIC-safe view of a chatbot: appearance + behavior, never secrets. */
export type PublicChatbotConfig = {
  public_key: string
  name: string
  welcome_message: string | null
  bubble_message: string | null
  avatar: string | null
  color: string
  position: "left" | "right"
  show_logo: boolean
  show_datetime: boolean
  embed_width: number
  embed_height: number
  allow_emoji: boolean
  allow_attachments: boolean
  collect_email: boolean
}

/**
 * Project a chatbot row onto its public config. Deliberately DOES NOT expose
 * `instructions` (the system prompt), `agent_id`, `channel_config`, `tenant_id`,
 * `reply_mode`, or anything else that is internal — this payload is served to
 * anonymous visitors on any origin.
 */
export const toPublicConfig = (bot: any): PublicChatbotConfig => ({
  public_key: bot.public_key,
  name: typeof bot.name === "string" && bot.name.trim() ? bot.name : "Chat",
  welcome_message: bot.welcome_message ?? bot.greeting ?? null,
  bubble_message: bot.bubble_message ?? null,
  avatar: bot.avatar ?? null,
  color: typeof bot.color === "string" && bot.color ? bot.color : "#017BE5",
  position: bot.position === "left" ? "left" : "right",
  show_logo: bot.show_logo !== false,
  show_datetime: bot.show_datetime !== false,
  embed_width: Number.isFinite(bot.embed_width) ? Number(bot.embed_width) : 420,
  embed_height: Number.isFinite(bot.embed_height)
    ? Number(bot.embed_height)
    : 745,
  allow_emoji: bot.allow_emoji !== false,
  allow_attachments: bot.allow_attachments !== false,
  collect_email: bot.collect_email !== false,
})

export { first }
