/**
 * GET /marketing-chat/messages — the widget polls the thread for replies.
 *
 * Query: { conversation_token, since? }. The token gates the read: it resolves
 * to exactly one "web_widget" conversation or we 404.
 *
 * MULTI-TENANT: the messages are listed with the tenant id taken FROM THE
 * RESOLVED CONVERSATION (never env), scoped to that conversation's id — so a
 * token minted for tenant A can only ever read tenant A's thread, and never
 * another tenant's messages.
 *
 * Returns the thread's messages (inbound visitor + outbound agent/AI) in
 * chronological order, filtered to `sent_at > since` when `since` is supplied so
 * the widget can poll incrementally.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"
import { resolveConversationByToken } from "../_chatbot"

export { OPTIONS }

const asTime = (v: any): number => {
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? 0 : t
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  applyCors(req, res)

  const token =
    typeof req.query.conversation_token === "string"
      ? req.query.conversation_token
      : ""
  const sinceRaw =
    typeof req.query.since === "string" ? req.query.since : undefined

  if (!token) {
    res.status(400).json({ error: "conversation_token_required" })
    return
  }

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const conversation = await resolveConversationByToken(mk, token)
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" })
      return
    }

    const rows = await mk.listMarketingMessages(
      {
        tenant_id: conversation.tenant_id,
        conversation_id: conversation.id,
      },
      { order: { sent_at: "ASC" } }
    )

    const sinceTime =
      sinceRaw != null && sinceRaw !== "" ? asTime(sinceRaw) : null

    const messages = (Array.isArray(rows) ? rows : [])
      // Internal notes (e.g. the handoff audit line the bot writes for the
      // inbox) are never shown to the visitor.
      .filter((m: any) => m.delivery_status !== "internal")
      .filter((m: any) =>
        sinceTime == null ? true : asTime(m.sent_at) > sinceTime
      )
      .sort((a: any, b: any) => asTime(a.sent_at) - asTime(b.sent_at))
      .map((m: any) => ({
        id: m.id,
        direction: m.direction,
        author: m.author,
        body: m.body ?? null,
        media: m.media ?? null,
        sent_at: m.sent_at,
      }))

    res.status(200).json({ messages })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] messages read failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_load_messages" })
  }
}
