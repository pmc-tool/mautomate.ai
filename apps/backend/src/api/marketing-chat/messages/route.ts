import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * GET /marketing-chat/messages — the widget polls the thread for replies.
 *
 * Query: { conversation_token, since? }. The token gates the read: it must map
 * to an existing "web_widget" conversation (tenant-scoped) or we 404. Returns
 * the thread's messages (inbound visitor + outbound agent/AI) in chronological
 * order, filtered to `sent_at > since` when `since` is supplied so the widget
 * can long-poll incrementally.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"

export { OPTIONS }

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

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

    const conversation = first(
      await mk.listMarketingConversations({
        tenant_id: TENANT_ID,
        channel: "web_widget",
        external_thread_id: token,
      })
    )
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" })
      return
    }

    const rows = await mk.listMarketingMessages(
      {
        tenant_id: TENANT_ID,
        conversation_id: conversation.id,
      },
      { order: { sent_at: "ASC" } }
    )

    const sinceTime =
      sinceRaw != null && sinceRaw !== "" ? asTime(sinceRaw) : null

    const messages = (Array.isArray(rows) ? rows : [])
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
