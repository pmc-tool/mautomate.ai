/**
 * POST /marketing-chat/message — the widget sends a visitor message.
 *
 * Body: { conversation_token, text }. The token gates the call: it resolves to
 * exactly one "web_widget" conversation or we 404 — this is the session
 * channel's stand-in for a signature.
 *
 * MULTI-TENANT: the owning tenant is read off the RESOLVED CONVERSATION, never
 * from env. The ingest then runs inside `withTenant(conversation.tenant_id)`, so
 * `ingestInbound` (which resolves session-channel tenants from the request
 * context) writes the message, and the auto-reply it triggers runs, under the
 * tenant that owns the chatbot this session was opened with.
 *
 * ABUSE GUARD: this is a public, unauthenticated endpoint whose messages trigger
 * PAID AI calls, so it is rate limited on two independent keys — the conversation
 * token (one abusive visitor) and the client IP (one abusive host minting many
 * sessions). Over the limit -> 429 + Retry-After, and nothing is written.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { clientIp, consumeRateLimit } from "../../../lib/rate-limit"
import { withTenant } from "../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { ingestInbound } from "../../../modules/marketing/messaging"
import type { InboundMessage } from "../../../modules/marketing/messaging"
import { applyCors, OPTIONS } from "../_cors"
import { resolveConversationByToken } from "../_chatbot"

export { OPTIONS }

/** Messages one conversation may send per window. */
const MESSAGE_LIMIT_PER_TOKEN = 20
/** Messages one client IP may send per window (across all its conversations). */
const MESSAGE_LIMIT_PER_IP = 60
const MESSAGE_WINDOW_SECONDS = 300

/** Hard ceiling on a single visitor message (an LLM prompt is billed by token). */
const MAX_TEXT_LENGTH = 2000

type Body = { conversation_token?: string; text?: string }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  applyCors(req, res)

  const token =
    typeof req.body?.conversation_token === "string"
      ? req.body.conversation_token
      : ""
  const rawText = typeof req.body?.text === "string" ? req.body.text : ""
  const text = rawText.trim().slice(0, MAX_TEXT_LENGTH)

  if (!token || !text) {
    res.status(400).json({ error: "conversation_token_and_text_required" })
    return
  }

  const ip = clientIp(req.headers as any, (req as any).ip)
  const [tokenLimit, ipLimit] = await Promise.all([
    consumeRateLimit(
      `mchat:msg:tok:${token}`,
      MESSAGE_LIMIT_PER_TOKEN,
      MESSAGE_WINDOW_SECONDS
    ),
    consumeRateLimit(
      `mchat:msg:ip:${ip}`,
      MESSAGE_LIMIT_PER_IP,
      MESSAGE_WINDOW_SECONDS
    ),
  ])
  const blocked = !tokenLimit.allowed
    ? tokenLimit
    : !ipLimit.allowed
      ? ipLimit
      : null
  if (blocked) {
    res.setHeader("Retry-After", String(blocked.retryAfter))
    res.status(429).json({
      error: "rate_limited",
      message: "You are sending messages too quickly. Please wait a moment.",
      retry_after: blocked.retryAfter,
    })
    return
  }

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const conversation = await resolveConversationByToken(mk, token)
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" })
      return
    }

    const tenantId: string = conversation.tenant_id

    const now = new Date()
    const inbound: InboundMessage = {
      channel: "web_widget",
      externalEventId: `ww_${token}_${now.getTime()}`,
      externalThreadId: token,
      externalMessageId: `ww_${token}_${now.getTime()}`,
      senderExternalId: token,
      // Session channel: no external receiving account. `ingestInbound` resolves
      // the tenant from the request context — which is exactly the tenant of the
      // conversation this token belongs to (set below).
      receivingAccountExternalId: null,
      text,
      media: [],
      sentAt: now,
    }

    await withTenant(tenantId, () => ingestInbound(req.scope, [inbound]))

    res.status(200).json({ ok: true })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] message ingest failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_send_message" })
  }
}
