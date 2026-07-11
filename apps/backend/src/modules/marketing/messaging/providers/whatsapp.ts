/**
 * WhatsApp Cloud API channel adapter. Inbound webhooks are authenticated with
 * Meta's HMAC-SHA256 (`x-hub-signature-256`) and the GET verify handshake.
 * Outbound sends hit the Graph API `/{phone_number_id}/messages` endpoint.
 *
 * MULTI-TENANT: `entry[].id` is the receiving WhatsApp Business Account (WABA)
 * id — emitted as `receivingAccountExternalId` so the shared ingest resolves the
 * owning tenant. NOTE: WhatsApp is not yet a connectable social_account platform
 * in this codebase, so these currently resolve to no account and are DROPPED
 * (fail closed) rather than written to a shared/default tenant.
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

class WhatsAppProvider implements MessagingProvider {
  readonly channel: MessagingChannel = "whatsapp"
  readonly label = "WhatsApp"
  readonly capabilities: MessagingCapabilities = {
    requiresAppConfig: true,
    maxTextLength: 4096,
    supportsMedia: true,
    inboundAuth: "hmac",
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_WHATSAPP_APP_SECRET &&
      !!process.env.MARKETING_WHATSAPP_VERIFY_TOKEN
    )
  }

  verifyWebhook(ctx: WebhookContext): boolean {
    return verifyMetaSignature(
      ctx.rawBody,
      ctx.headers,
      process.env.MARKETING_WHATSAPP_APP_SECRET
    )
  }

  verifyChallenge(ctx: WebhookContext): string | null {
    return verifyMetaChallenge(
      ctx.query,
      process.env.MARKETING_WHATSAPP_VERIFY_TOKEN
    )
  }

  parseInbound(ctx: WebhookContext): InboundMessage[] {
    const body = ctx?.body
    const entries = Array.isArray(body?.entry) ? body.entry : []
    const out: InboundMessage[] = []

    for (const entry of entries) {
      // `entry.id` is the receiving WhatsApp Business Account id.
      const receivingAccountExternalId =
        entry?.id != null ? String(entry.id) : null
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        const value = change?.value
        const messages = Array.isArray(value?.messages) ? value.messages : []
        const contacts = Array.isArray(value?.contacts) ? value.contacts : []
        const contactName = contacts?.[0]?.profile?.name ?? null

        for (const message of messages) {
          if (!message?.id || !message?.from) {
            continue
          }

          const tsSeconds = Number(message.timestamp)
          const sentAt = Number.isFinite(tsSeconds)
            ? new Date(tsSeconds * 1000)
            : new Date()

          out.push({
            channel: this.channel,
            externalEventId: String(message.id),
            externalThreadId: String(message.from),
            externalMessageId: String(message.id),
            senderExternalId: String(message.from),
            receivingAccountExternalId,
            senderName: contactName,
            senderPhone: String(message.from),
            text: message.text?.body ?? null,
            media: [],
            sentAt,
          })
        }
      }
    }

    return out
  }

  async sendMessage(input: OutboundMessage): Promise<SendResult> {
    const token = input.credentials?.accessToken
    const phoneNumberId = input.credentials?.meta?.phone_number_id
    if (!token || !phoneNumberId) {
      return {
        ok: false,
        error: {
          message: "Missing WhatsApp access token or phone_number_id",
          retryable: false,
        },
      }
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: input.externalThreadId,
            type: "text",
            text: { body: input.text ?? "" },
          }),
        }
      )

      const data: any = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          ok: false,
          error: {
            message:
              data?.error?.message ?? `WhatsApp send failed (${res.status})`,
            retryable: res.status >= 500 || res.status === 429,
            code: data?.error?.code ? String(data.error.code) : String(res.status),
          },
        }
      }

      return {
        ok: true,
        externalMessageId: data?.messages?.[0]?.id ?? null,
        deliveryStatus: "sent",
      }
    } catch (e: any) {
      return {
        ok: false,
        error: {
          message: e?.message ?? "WhatsApp network error",
          retryable: true,
        },
      }
    }
  }
}

registerMessagingProvider(new WhatsAppProvider())
