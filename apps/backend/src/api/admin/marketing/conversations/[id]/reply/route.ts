import { resolveTenantId } from "../../../../../../lib/tenant-context"
/**
 * POST /admin/marketing/conversations/:id/reply
 *
 * Send an agent reply on a conversation's channel. The message is ALWAYS
 * recorded to the thread (so it shows even when the external send fails or the
 * channel has no connected account) — only `delivered` reflects the external
 * outcome.
 *
 * Channel → outbound credential resolution:
 *   telegram  → social account platform "telegram"
 *   messenger → "facebook"
 *   instagram → "instagram"
 *   whatsapp  → "whatsapp"
 *   web_widget → no external account; the provider stores the reply for polling.
 * Any other channel (email/review) has no send path → recorded, not delivered.
 *
 * Graceful degradation (never 500 on a missing provider/account/credential):
 *   - no connected account / no credential → deliveryStatus "no_channel_credential"
 *   - external send failure                → deliveryStatus "failed"
 *   - web_widget                           → provider returns ok "stored"
 *
 * Body: { text: string, media?: MessageMedia[] }
 * Response: { message: MessageDto, delivered: boolean }
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import {
  getMessagingProvider,
  recordOutboundMessage,
} from "../../../../../../modules/marketing/messaging"
import type { SendResult } from "../../../../../../modules/marketing/messaging"
import { openCredentials } from "../../../../../../modules/marketing/publish/credentials"
import { toMessageDto } from "../../_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

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

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const { id } = req.params

    const conversation = await mk
      .retrieveMarketingConversation(id)
      .catch(() => null)
    if (!conversation || conversation.tenant_id !== TENANT_ID) {
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

    // --- Resolve outbound credentials ---------------------------------------
    let credentials: { accessToken: string | null; meta: Record<string, any> | null } =
      { accessToken: null, meta: null }
    let skipSend = false

    const hasMapping = Object.prototype.hasOwnProperty.call(
      CHANNEL_PLATFORM,
      channel
    )
    const platform = hasMapping ? CHANNEL_PLATFORM[channel] : undefined

    if (!hasMapping) {
      // Channel with no outbound send path (email/review).
      skipSend = true
    } else if (platform === null) {
      // web_widget: no external account; provider stores the reply itself.
    } else {
      const accounts = await mk.listMarketingSocialAccounts({
        tenant_id: TENANT_ID,
        platform,
      })
      const account = first(accounts)
      if (!account) {
        skipSend = true
      } else {
        const creds = await openCredentials(mk, TENANT_ID, account.id)
        if (!creds || !creds.accessToken) {
          skipSend = true
        } else {
          credentials = { accessToken: creds.accessToken, meta: creds.meta }
        }
      }
    }

    // --- Attempt the external send ------------------------------------------
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
            error: {
              message: e?.message ?? "send failed",
              retryable: false,
            },
          }
        }
      }
    }

    // --- Always record the reply to the thread ------------------------------
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

    res.json({
      message: toMessageDto(recorded),
      delivered: result.ok,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to send reply",
    })
  }
}
