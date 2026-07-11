/**
 * Facebook Messenger channel adapter. Inbound webhooks are authenticated with
 * Meta's HMAC-SHA256 (`x-hub-signature-256`) and the GET verify handshake.
 * Outbound sends hit the Graph API `/me/messages` Send API endpoint.
 *
 * MULTI-TENANT: `entry[].id` is the receiving PAGE id — the key that attributes
 * the message to the owning store. It is emitted as `receivingAccountExternalId`
 * so the shared ingest resolves the tenant from the connected "facebook"
 * account; a message whose page is not connected is dropped, not defaulted.
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

class MessengerProvider implements MessagingProvider {
  readonly channel: MessagingChannel = "messenger"
  readonly label = "Messenger"
  readonly capabilities: MessagingCapabilities = {
    requiresAppConfig: true,
    maxTextLength: 2000,
    supportsMedia: true,
    inboundAuth: "hmac",
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_MESSENGER_APP_SECRET &&
      !!process.env.MARKETING_MESSENGER_VERIFY_TOKEN
    )
  }

  verifyWebhook(ctx: WebhookContext): boolean {
    return verifyMetaSignature(
      ctx.rawBody,
      ctx.headers,
      process.env.MARKETING_MESSENGER_APP_SECRET
    )
  }

  verifyChallenge(ctx: WebhookContext): string | null {
    return verifyMetaChallenge(
      ctx.query,
      process.env.MARKETING_MESSENGER_VERIFY_TOKEN
    )
  }

  parseInbound(ctx: WebhookContext): InboundMessage[] {
    const body = ctx?.body
    const entries = Array.isArray(body?.entry) ? body.entry : []
    const out: InboundMessage[] = []

    for (const entry of entries) {
      // `entry.id` is the receiving Page id — attributes the message to a store.
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
        error: { message: "Missing Messenger page access token", retryable: false },
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
              data?.error?.message ?? `Messenger send failed (${res.status})`,
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
          message: e?.message ?? "Messenger network error",
          retryable: true,
        },
      }
    }
  }
}

registerMessagingProvider(new MessengerProvider())
