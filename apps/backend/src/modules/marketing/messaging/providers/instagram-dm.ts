/**
 * Instagram Direct Message channel adapter. IG DM rides Meta's messaging
 * product, so its webhook shares Messenger's `entry[].messaging[]` shape and its
 * Send API is the same `/me/messages` endpoint.
 *
 * NOTE: IG DM requires the `instagram_manage_messages` permission. In dev mode
 * this works for accounts added to the app; production requires Meta app review
 * to grant the permission to arbitrary Instagram business accounts.
 *
 * MULTI-TENANT: `entry[].id` is the receiving IG account id — the key that
 * attributes the message to the owning store. It is emitted as
 * `receivingAccountExternalId` so the shared ingest resolves the tenant from the
 * connected "instagram" account; unconnected accounts are dropped, not defaulted.
 */

import { registerMessagingProvider } from "../registry"
import { verifyMetaChallenge, verifyMetaSignature } from "./_meta"
import type {
  InboundMessage,
  MessagingCapabilities,
  MessagingChannel,
  MessagingProvider,
  OutboundMessage,
  SendResult,
  WebhookContext,
} from "../types"

class InstagramDmProvider implements MessagingProvider {
  readonly channel: MessagingChannel = "instagram"
  readonly label = "Instagram"
  readonly capabilities: MessagingCapabilities = {
    requiresAppConfig: true,
    maxTextLength: 1000,
    supportsMedia: true,
    inboundAuth: "hmac",
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_INSTAGRAM_APP_SECRET &&
      !!process.env.MARKETING_INSTAGRAM_VERIFY_TOKEN
    )
  }

  verifyWebhook(ctx: WebhookContext): boolean {
    return verifyMetaSignature(
      ctx.rawBody,
      ctx.headers,
      process.env.MARKETING_INSTAGRAM_APP_SECRET
    )
  }

  verifyChallenge(ctx: WebhookContext): string | null {
    return verifyMetaChallenge(
      ctx.query,
      process.env.MARKETING_INSTAGRAM_VERIFY_TOKEN
    )
  }

  parseInbound(ctx: WebhookContext): InboundMessage[] {
    const body = ctx?.body
    const entries = Array.isArray(body?.entry) ? body.entry : []
    const out: InboundMessage[] = []

    for (const entry of entries) {
      // `entry.id` is the receiving IG account id — attributes to a store.
      const receivingAccountExternalId =
        entry?.id != null ? String(entry.id) : null
      const events = Array.isArray(entry?.messaging) ? entry.messaging : []
      for (const event of events) {
        const senderId = event?.sender?.id
        const message = event?.message
        if (!senderId || !message?.mid) {
          continue
        }

        const ts = Number(event.timestamp)
        const sentAt = Number.isFinite(ts) ? new Date(ts) : new Date()

        out.push({
          channel: this.channel,
          externalEventId: `${senderId}_${message.mid}`,
          externalThreadId: String(senderId),
          externalMessageId: String(message.mid),
          senderExternalId: String(senderId),
          receivingAccountExternalId,
          text: message.text ?? null,
          media: [],
          sentAt,
        })
      }
    }

    return out
  }

  async sendMessage(input: OutboundMessage): Promise<SendResult> {
    const token = input.credentials?.accessToken
    if (!token) {
      return {
        ok: false,
        error: { message: "Missing Instagram access token", retryable: false },
      }
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(
          token
        )}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipient: { id: input.externalThreadId },
            message: { text: input.text ?? "" },
            messaging_type: "RESPONSE",
          }),
        }
      )

      const data: any = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          ok: false,
          error: {
            message:
              data?.error?.message ?? `Instagram send failed (${res.status})`,
            retryable: res.status >= 500 || res.status === 429,
            code: data?.error?.code ? String(data.error.code) : String(res.status),
          },
        }
      }

      return {
        ok: true,
        externalMessageId: data?.message_id ?? null,
        deliveryStatus: "sent",
      }
    } catch (e: any) {
      return {
        ok: false,
        error: {
          message: e?.message ?? "Instagram network error",
          retryable: true,
        },
      }
    }
  }
}

registerMessagingProvider(new InstagramDmProvider())
