/**
 * Telegram Bot channel adapter. Inbound updates arrive on the bot webhook and
 * are authenticated via the `x-telegram-bot-api-secret-token` header (set when
 * the webhook is registered). Outbound sends hit the Bot API `sendMessage`.
 *
 * MULTI-TENANT: a Telegram update carries no stable receiving-account id in its
 * payload, so the receiving BOT is identified by the per-bot secret token it was
 * registered with. That token is emitted as `receivingAccountSecret` so the
 * shared ingest resolves the owning tenant from the connected "telegram" account
 * (matched on meta.webhook_secret). An unmatched secret is DROPPED (fail closed).
 */

import { registerMessagingProvider } from "../registry"
import type {
  InboundMessage,
  MessageMedia,
  MessagingCapabilities,
  MessagingChannel,
  MessagingProvider,
  OutboundMessage,
  SendResult,
  WebhookContext,
} from "../types"

const headerValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null => {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()]
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }
  return typeof raw === "string" ? raw : null
}

class TelegramProvider implements MessagingProvider {
  readonly channel: MessagingChannel = "telegram"
  readonly label = "Telegram"
  readonly capabilities: MessagingCapabilities = {
    requiresAppConfig: false,
    maxTextLength: 4096,
    supportsMedia: true,
    inboundAuth: "secret_token",
  }

  isConfigured(): boolean {
    return true
  }

  verifyWebhook(ctx: WebhookContext): boolean {
    // Each connected bot registers its OWN per-bot secret token at connect time
    // (setWebhook secret_token), stored as social_account.meta.webhook_secret --
    // there is no single global secret to compare against here. This perimeter
    // gate only requires the secret-token header to be PRESENT; the
    // AUTHORITATIVE, tenant-attributing check is the timing-safe match against
    // the receiving account's stored secret in `./inbound`
    // (resolveTelegramTenantId), which DROPS any update whose token matches no
    // connected bot (fail closed). A token that matches nothing writes nothing.
    const provided = headerValue(
      ctx.headers,
      "x-telegram-bot-api-secret-token"
    )
    return typeof provided === "string" && provided.length > 0
  }

  verifyChallenge(_ctx: WebhookContext): string | null {
    return null
  }

  parseInbound(ctx: WebhookContext): InboundMessage[] {
    const update = ctx?.body
    const message = update?.message
    if (!update || !message || !message.chat) {
      return []
    }

    const chatId = message.chat?.id
    if (chatId === undefined || chatId === null) {
      return []
    }

    // The per-bot secret token identifies the RECEIVING bot (and thus tenant),
    // since the update payload has no stable receiving-account id.
    const receivingAccountSecret = headerValue(
      ctx.headers,
      "x-telegram-bot-api-secret-token"
    )

    const from = message.from ?? {}
    const senderName = `${from.first_name ?? ""} ${from.last_name ?? ""}`.trim()

    const media: MessageMedia[] = []
    if (Array.isArray(message.photo) && message.photo.length) {
      const largest = message.photo[message.photo.length - 1]
      if (largest?.file_id) {
        media.push({
          url: String(largest.file_id),
          kind: "image",
          mime: null,
          alt: message.caption ?? null,
        })
      }
    }
    if (message.document?.file_id) {
      media.push({
        url: String(message.document.file_id),
        kind: "file",
        mime: message.document.mime_type ?? null,
        alt: message.document.file_name ?? null,
      })
    }

    const sentAtSeconds = Number(message.date)
    const sentAt = Number.isFinite(sentAtSeconds)
      ? new Date(sentAtSeconds * 1000)
      : new Date()

    return [
      {
        channel: this.channel,
        externalEventId: `tg_${update.update_id}`,
        externalThreadId: String(chatId),
        externalMessageId: `tg_${chatId}_${message.message_id}`,
        senderExternalId: String(from.id ?? chatId),
        receivingAccountExternalId: null,
        receivingAccountSecret,
        senderName: senderName || null,
        text: message.text ?? message.caption ?? null,
        media,
        sentAt,
      },
    ]
  }

  async sendMessage(input: OutboundMessage): Promise<SendResult> {
    const token = input.credentials?.accessToken
    if (!token) {
      return {
        ok: false,
        error: { message: "Missing Telegram bot token", retryable: false },
      }
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: input.externalThreadId,
            text: input.text ?? "",
          }),
        }
      )

      const data: any = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          error: {
            message: data?.description ?? `Telegram send failed (${res.status})`,
            retryable: res.status >= 500 || res.status === 429,
            code: data?.error_code ? String(data.error_code) : String(res.status),
          },
        }
      }

      const result = data.result ?? {}
      const chatId = result.chat?.id ?? input.externalThreadId
      return {
        ok: true,
        externalMessageId: `tg_${chatId}_${result.message_id}`,
        deliveryStatus: "sent",
      }
    } catch (e: any) {
      return {
        ok: false,
        error: {
          message: e?.message ?? "Telegram network error",
          retryable: true,
        },
      }
    }
  }
}

registerMessagingProvider(new TelegramProvider())
