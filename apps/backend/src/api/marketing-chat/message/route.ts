import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * POST /marketing-chat/message — the widget sends a visitor message.
 *
 * Body: { conversation_token, text }. The token gates the call: it must map to
 * an existing "web_widget" conversation (tenant-scoped) or we 404 — this is the
 * session channel's stand-in for a signature. On success we hand a single
 * normalized `InboundMessage` to `ingestInbound`, which owns idempotency and
 * conversation/unread bookkeeping (the same path platform webhooks take).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { ingestInbound } from "../../../modules/marketing/messaging"
import type { InboundMessage } from "../../../modules/marketing/messaging"
import { applyCors, OPTIONS } from "../_cors"

export { OPTIONS }

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

type Body = { conversation_token?: string; text?: string }

export const POST = async (
  req: MedusaRequest<Body>,
  res: MedusaResponse
) => {
  applyCors(req, res)

  const token =
    typeof req.body?.conversation_token === "string"
      ? req.body.conversation_token
      : ""
  const text = typeof req.body?.text === "string" ? req.body.text : ""

  if (!token || !text.trim()) {
    res.status(400).json({ error: "conversation_token_and_text_required" })
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

    const now = new Date()
    const inbound: InboundMessage = {
      channel: "web_widget",
      externalEventId: `ww_${token}_${now.getTime()}`,
      externalThreadId: token,
      externalMessageId: `ww_${token}_${now.getTime()}`,
      senderExternalId: token,
      // Session channel: no external receiving account; ingest resolves the
      // tenant from the request context (this route is gated by the token).
      receivingAccountExternalId: null,
      text,
      media: [],
      sentAt: now,
    }

    await ingestInbound(req.scope, [inbound])

    res.status(200).json({ ok: true })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] message ingest failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_send_message" })
  }
}
