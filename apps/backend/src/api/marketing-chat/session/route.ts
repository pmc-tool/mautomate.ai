import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * POST /marketing-chat/session — open a fresh anonymous web-widget conversation.
 *
 * Public + anonymous: the storefront widget has no auth. Identity is an opaque
 * conversation token we mint here (`crypto.randomBytes(24).base64url`) which IS
 * the conversation's `external_thread_id` on channel "web_widget". The widget
 * stores it and presents it on every subsequent call; it is the ONLY secret the
 * widget holds and the ONLY token we ever return.
 *
 * We create the conversation directly via the marketing service (mirroring the
 * shape `ingestInbound` writes: tenant_id, channel "web_widget", the token as
 * external_thread_id, status open) — reusing `ingestInbound` for an empty
 * session would require a synthetic message.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"

export { OPTIONS }

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

type Body = { visitor_name?: string }

export const POST = async (
  req: MedusaRequest<Body>,
  res: MedusaResponse
) => {
  applyCors(req, res)

  const token = crypto.randomBytes(24).toString("base64url")
  const now = new Date()
  const visitorName =
    typeof req.body?.visitor_name === "string"
      ? req.body.visitor_name.trim() || null
      : null

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    // Attach a contact when the visitor volunteered a name, mirroring the
    // contact upsert `ingestInbound` performs. Best-effort — the conversation
    // (keyed by the token) is the durable thread either way.
    let contactId: string | null = null
    if (visitorName) {
      const contact = first(
        await mk.createMarketingContacts({
          tenant_id: TENANT_ID,
          display_name: visitorName,
          primary_channel: "web_widget",
          meta: { external_ids: { web_widget: token } },
        } as any)
      )
      contactId = contact?.id ?? null
    }

    const conversation = first(
      await mk.createMarketingConversations({
        tenant_id: TENANT_ID,
        channel: "web_widget",
        external_thread_id: token,
        contact_id: contactId,
        status: "open",
        last_message_at: now,
        unread_count: 0,
      } as any)
    )

    res.status(200).json({
      conversation_token: token,
      conversation_id: conversation?.id,
    })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] session create failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_start_session" })
  }
}
