/**
 * POST /marketing-chat/session — open a fresh anonymous web-widget conversation.
 *
 * MULTI-TENANT: the caller presents the chatbot's `public_key` (body
 * `public_key`, or the `x-chatbot-key` header). That key resolves to exactly one
 * ACTIVE marketing_chatbot, whose `tenant_id` owns the conversation we create —
 * the tenant is NEVER read from env. An unknown/inactive key is a 404 (fail
 * closed): no key, no conversation.
 *
 * Public + anonymous: the widget has no auth. Identity is an opaque conversation
 * token minted here (`crypto.randomBytes(24).base64url`) which IS the
 * conversation's `external_thread_id` on channel "web_widget". The widget stores
 * it and presents it on every subsequent call; it is the ONLY secret the widget
 * holds and the ONLY token we ever return.
 *
 * The conversation is created with `chatbot_id` set to the resolved bot, so the
 * auto-reply runtime (messaging/auto-reply) answers with THAT bot's persona and
 * knowledge, and `handler_mode` stays "ai" until the bot hands off.
 *
 * ABUSE GUARD: session minting is rate limited per client IP (session creation
 * writes a row; the AI spend is guarded on /message).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { clientIp, consumeRateLimit } from "../../../lib/rate-limit"
import { withTenant } from "../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"
import { first, readPublicKey, resolveChatbotByPublicKey } from "../_chatbot"

export { OPTIONS }

/** Sessions a single IP may open in one window (a session is cheap but not free). */
const SESSION_LIMIT_PER_IP = 30
const SESSION_WINDOW_SECONDS = 300

type Body = { visitor_name?: string; public_key?: string }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  applyCors(req, res)

  const publicKey = readPublicKey(req)
  if (!publicKey) {
    res.status(400).json({ error: "public_key_required" })
    return
  }

  const ip = clientIp(req.headers as any, (req as any).ip)
  const ipLimit = await consumeRateLimit(
    `mchat:session:ip:${ip}`,
    SESSION_LIMIT_PER_IP,
    SESSION_WINDOW_SECONDS
  )
  if (!ipLimit.allowed) {
    res.setHeader("Retry-After", String(ipLimit.retryAfter))
    res.status(429).json({
      error: "rate_limited",
      message: "Too many chat sessions. Please try again shortly.",
      retry_after: ipLimit.retryAfter,
    })
    return
  }

  const token = crypto.randomBytes(24).toString("base64url")
  const now = new Date()
  const visitorName =
    typeof req.body?.visitor_name === "string"
      ? req.body.visitor_name.trim() || null
      : null

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await resolveChatbotByPublicKey(mk, publicKey)
    if (!chatbot) {
      // Fail closed. Same answer for "unknown key" and "inactive bot" so the
      // endpoint cannot be used to enumerate keys.
      res.status(404).json({ error: "chatbot_not_found" })
      return
    }

    const tenantId: string = chatbot.tenant_id

    // Every write runs inside the bot's tenant context, so any tenant-aware
    // code downstream sees the right store (never the request-less default).
    const conversation = await withTenant(tenantId, async () => {
      // Attach a contact when the visitor volunteered a name, mirroring the
      // contact upsert `ingestInbound` performs. Best-effort — the conversation
      // (keyed by the token) is the durable thread either way.
      let contactId: string | null = null
      if (visitorName) {
        const contact = first(
          await mk.createMarketingContacts({
            tenant_id: tenantId,
            display_name: visitorName,
            primary_channel: "web_widget",
            meta: { external_ids: { web_widget: token } },
          } as any)
        )
        contactId = contact?.id ?? null
      }

      return first(
        await mk.createMarketingConversations({
          tenant_id: tenantId,
          channel: "web_widget",
          external_thread_id: token,
          chatbot_id: chatbot.id,
          handler_mode: "ai",
          contact_id: contactId,
          status: "open",
          last_message_at: now,
          unread_count: 0,
        } as any)
      )
    })

    res.status(200).json({
      conversation_token: token,
      conversation_id: conversation?.id,
      // Extension (backwards compatible): lets the widget greet without a
      // second round-trip to /config.
      welcome_message: chatbot.welcome_message ?? chatbot.greeting ?? null,
    })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] session create failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_start_session" })
  }
}
