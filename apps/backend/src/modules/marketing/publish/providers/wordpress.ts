/**
 * WordPress publish adapter — LIVE. Publishes a blog post to a self-hosted or
 * WP.com site via the WP REST API using an Application Password (Basic auth).
 *
 * APP-level integration needs no shared keys — every site brings its own
 * credentials on the connected account — so `isConfigured()` is always true.
 * Per-site secrets arrive decrypted in `input.credentials`:
 *   - site_url  → credentials.meta.site_url
 *   - username  → credentials.meta.username
 *   - app_pw    → credentials.accessToken
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

class WordpressProvider implements PublishProvider {
  readonly platform = "wordpress" as const
  readonly label = "WordPress"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: null,
    supportsHashtags: false,
    supportsScheduling: false,
    connect: "app_password" as const,
  }

  isConfigured(): boolean {
    return true
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const meta = input.credentials.meta ?? {}
    const siteUrl = (meta.site_url as string | undefined)?.replace(/\/+$/, "")
    const username = meta.username as string | undefined
    const appPassword = input.credentials.accessToken

    if (!siteUrl || !username || !appPassword) {
      return {
        ok: false,
        error: {
          message: "Missing WordPress site_url, username, or app password",
          retryable: false,
          code: "auth",
        },
      }
    }

    const body = input.content.body ?? ""
    const title =
      input.content.title ?? body.split("\n")[0]?.trim() ?? "Untitled"
    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64")

    let res: Response
    try {
      res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, content: body, status: "publish" }),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting WordPress: ${
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
        data?.message ?? `WordPress responded with status ${res.status}`
      return mapHttpError(res.status, message)
    }

    return {
      ok: true,
      externalId: data?.id != null ? String(data.id) : null,
      url: data?.link ?? null,
    }
  }
}

registerProvider(new WordpressProvider())
