import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import {
  getMessagingProvider,
  recordOutboundMessage,
} from "../../../../../../modules/marketing/messaging"
import type { SendResult } from "../../../../../../modules/marketing/messaging"
import { openCredentials } from "../../../../../../modules/marketing/publish/credentials"
import { resolveMerchant } from "../../../../_helpers"
import { toMessageDto } from "../../_dto"

/** conversation.channel → social account platform (null = no external account). */
const CHANNEL_PLATFORM: Record<string, string | null> = {
  telegram: "telegram",
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
  web_widget: null,
}

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? v[0] ?? null : v ?? null

/**
 * POST /merchant/marketing/conversations/:id/reply
 *
 * Send an agent reply on the conversation's channel. The message is ALWAYS
 * recorded to the thread (so it shows even when the external send fails or the
 * channel has no connected account) — only `delivered` reflects the external
 * outcome. Tenant-scoped.
 * Body: { text, media? }
 * Response: { message, delivered }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const conversation = await mk
      .retrieveMarketingConversation(id)
      .catch(() => null)
    if (!conversation || conversation.tenant_id !== tenantId) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    const body = (req.body ?? {}) as { text?: string; media?: any[] }
    const text = typeof body.text === "string" ? body.text : ""
    const media = Array.isArray(body.media) ? body.media : []
    if (!text.trim() && media.length === 0) {
      res.status(400).json({ message: "A reply must include text or media" })
      return
    }

    const channel = conversation.channel as string

    let credentials: {
      accessToken: string | null
      meta: Record<string, any> | null
    } = { accessToken: null, meta: null }
    let skipSend = false

    const hasMapping = Object.prototype.hasOwnProperty.call(
      CHANNEL_PLATFORM,
      channel
    )
    const platform = hasMapping ? CHANNEL_PLATFORM[channel] : undefined

    if (!hasMapping) {
      skipSend = true
    } else if (platform === null) {
      // web_widget: no external account; provider stores the reply itself.
    } else {
      const accounts = await mk.listMarketingSocialAccounts({
        tenant_id: tenantId,
        platform,
      })
      const account = first(accounts)
      if (!account) {
        skipSend = true
      } else {
        const creds = await openCredentials(mk, tenantId, account.id)
        if (!creds || !creds.accessToken) {
          skipSend = true
        } else {
          credentials = { accessToken: creds.accessToken, meta: creds.meta }
        }
      }
    }

    let result: SendResult
    if (skipSend) {
      result = { ok: false, deliveryStatus: "no_channel_credential" }
    } else {
      const provider = getMessagingProvider(channel)
      if (!provider) {
        result = { ok: false, deliveryStatus: "no_channel_credential" }
      } else {
        try {
          result = await provider.sendMessage({
            channel: channel as any,
            externalThreadId: conversation.external_thread_id ?? "",
            credentials,
            text,
            media,
          })
        } catch (e: any) {
          result = {
            ok: false,
            deliveryStatus: "failed",
            error: { message: e?.message ?? "send failed", retryable: false },
          }
        }
      }
    }

    const deliveryStatus = result.ok
      ? result.deliveryStatus ?? "sent"
      : result.deliveryStatus ?? "failed"

    const recorded = await recordOutboundMessage(req.scope, {
      conversationId: conversation.id,
      body: text,
      author: "agent",
      media,
      externalMessageId: result.externalMessageId ?? null,
      deliveryStatus,
    })

    res.json({ message: toMessageDto(recorded), delivered: result.ok })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to send reply",
    })
  }
}
