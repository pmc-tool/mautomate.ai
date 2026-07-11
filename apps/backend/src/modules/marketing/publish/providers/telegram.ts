/**
 * Telegram publish adapter — LIVE. Posts to a channel via the Bot API. The bot
 * token lives per-account (arrives as `credentials.accessToken`), so there is
 * no shared app key and `isConfigured()` is always true.
 *
 * This adapter OVERRIDES the mock's "telegram" slot (registered later in
 * index.ts, last-registration-wins). The class name is kept as
 * `TelegramProvider` intentionally.
 */

import { registerProvider } from "../registry"
import type {
  PublishInput,
  PublishProvider,
  PublishResult,
} from "../types"

const mapHttpError = (
  status: number,
  message: string
): PublishResult => {
  if (status === 401 || status === 403) {
    return { ok: false, error: { message, retryable: false, code: "auth" } }
  }
  if (status === 429) {
    return {
      ok: false,
      error: { message, retryable: true, code: "rate_limit" },
    }
  }
  if (status >= 500) {
    return { ok: false, error: { message, retryable: true, code: "server" } }
  }
  return {
    ok: false,
    error: { message, retryable: false, code: "bad_request" },
  }
}

class TelegramProvider implements PublishProvider {
  readonly platform = "telegram" as const
  readonly label = "Telegram"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: 4096,
    supportsHashtags: true,
    supportsScheduling: false,
    connect: "webhook_token" as const,
  }

  isConfigured(): boolean {
    return true
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const meta = input.credentials.meta ?? {}
    const token = input.credentials.accessToken
    const chatId =
      input.account.external_id ?? (meta.chat_id as string | undefined) ?? null

    if (!token || !chatId) {
      return {
        ok: false,
        error: {
          message: "Missing Telegram bot token or chat id",
          retryable: false,
          code: "auth",
        },
      }
    }

    const parts: string[] = []
    if (input.content.body) parts.push(input.content.body)
    if (input.content.hashtags?.length) {
      parts.push(input.content.hashtags.map((h) => `#${h}`).join(" "))
    }
    const text = parts.join("\n\n")

    const media = input.media[0]
    let endpoint: string
    let payload: Record<string, any>
    if (media?.kind === "image") {
      endpoint = "sendPhoto"
      payload = { chat_id: chatId, photo: media.url, caption: text }
    } else if (media?.kind === "video") {
      endpoint = "sendVideo"
      payload = { chat_id: chatId, video: media.url, caption: text }
    } else {
      endpoint = "sendMessage"
      payload = { chat_id: chatId, text }
    }

    let res: Response
    try {
      res = await fetch(
        `https://api.telegram.org/bot${token}/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting Telegram: ${
            (e as Error).message
          }`,
          retryable: true,
          code: "network",
        },
      }
    }

    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok || data?.ok === false) {
      const message =
        data?.description ?? `Telegram responded with status ${res.status}`
      return mapHttpError(res.status, message)
    }

    const messageId = data?.result?.message_id
    const handle = input.account.handle
    return {
      ok: true,
      externalId: messageId != null ? String(messageId) : null,
      url:
        handle && messageId != null
          ? `https://t.me/${handle}/${messageId}`
          : null,
    }
  }
}

registerProvider(new TelegramProvider())
