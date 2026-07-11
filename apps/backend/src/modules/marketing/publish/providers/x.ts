/**
 * X (Twitter) publish adapter — posts a tweet via the v2 API with a per-account
 * OAuth2 bearer token. The APP-level integration is gated on the X client
 * id/secret env.
 */

import { registerProvider } from "../registry"
import type {
  PublishInput,
  PublishProvider,
  PublishResult,
} from "../types"

const MAX_LEN = 280

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

class XProvider implements PublishProvider {
  readonly platform = "x" as const
  readonly label = "X"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: MAX_LEN,
    supportsHashtags: true,
    supportsScheduling: false,
    connect: "oauth" as const,
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_X_CLIENT_ID &&
      !!process.env.MARKETING_X_CLIENT_SECRET
    )
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const accessToken = input.credentials.accessToken
    if (!accessToken) {
      return {
        ok: false,
        error: {
          message: "Missing X access token",
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
    let text = parts.join("\n\n")
    if (text.length > MAX_LEN) {
      text = text.slice(0, MAX_LEN)
    }

    let res: Response
    try {
      res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting X: ${(e as Error).message}`,
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
        data?.detail ??
        data?.title ??
        `X responded with status ${res.status}`
      return mapHttpError(res.status, message)
    }

    const id = data?.data?.id ?? null
    const handle = input.account.handle
    return {
      ok: true,
      externalId: id != null ? String(id) : null,
      url:
        handle && id != null
          ? `https://x.com/${handle}/status/${id}`
          : id != null
          ? `https://x.com/i/status/${id}`
          : null,
    }
  }
}

registerProvider(new XProvider())
