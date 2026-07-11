/**
 * Facebook publish adapter — posts to a Page feed via the Graph API. The
 * APP-level integration is gated on the Meta app id/secret env; per-Page access
 * tokens arrive decrypted in `input.credentials`.
 */

import { registerProvider } from "../registry"
import type {
  PublishInput,
  PublishProvider,
  PublishResult,
} from "../types"

const GRAPH = "https://graph.facebook.com/v21.0"

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

class FacebookProvider implements PublishProvider {
  readonly platform = "facebook" as const
  readonly label = "Facebook"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: 63206,
    supportsHashtags: true,
    supportsScheduling: true,
    connect: "oauth" as const,
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_FACEBOOK_APP_ID &&
      !!process.env.MARKETING_FACEBOOK_APP_SECRET
    )
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const meta = input.credentials.meta ?? {}
    const pageId =
      input.account.external_id ?? (meta.page_id as string | undefined) ?? null
    const accessToken = input.credentials.accessToken

    if (!pageId || !accessToken) {
      return {
        ok: false,
        error: {
          message: "Missing Facebook page id or access token",
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
    const message = parts.join("\n\n")

    const media = input.media[0]
    let url: string
    let payload: Record<string, any>
    if (media) {
      url = `${GRAPH}/${pageId}/photos`
      payload = { url: media.url, caption: message, access_token: accessToken }
    } else {
      url = `${GRAPH}/${pageId}/feed`
      payload = { message, access_token: accessToken }
      if (input.content.link) payload.link = input.content.link
    }

    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting Facebook: ${
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

    if (!res.ok) {
      const message =
        data?.error?.message ??
        `Facebook responded with status ${res.status}`
      return mapHttpError(res.status, message)
    }

    const id = data?.post_id ?? data?.id ?? null
    return {
      ok: true,
      externalId: id != null ? String(id) : null,
      url: id != null ? `https://facebook.com/${id}` : null,
    }
  }
}

registerProvider(new FacebookProvider())
