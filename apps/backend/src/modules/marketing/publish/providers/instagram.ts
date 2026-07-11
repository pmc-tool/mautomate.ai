/**
 * Instagram publish adapter — Graph API two-step container publish. Media is
 * REQUIRED. The APP-level integration is gated on the same Meta app id/secret
 * env as Facebook; per-account access tokens arrive in `input.credentials`.
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

class InstagramProvider implements PublishProvider {
  readonly platform = "instagram" as const
  readonly label = "Instagram"
  readonly capabilities = {
    media: "required" as const,
    maxTextLength: 2200,
    supportsHashtags: true,
    supportsScheduling: false,
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
    const igUserId =
      input.account.external_id ??
      (meta.ig_user_id as string | undefined) ??
      null
    const accessToken = input.credentials.accessToken

    if (!igUserId || !accessToken) {
      return {
        ok: false,
        error: {
          message: "Missing Instagram user id or access token",
          retryable: false,
          code: "auth",
        },
      }
    }

    const media = input.media[0]
    if (!media) {
      return {
        ok: false,
        error: {
          message: "Instagram requires an image or video to publish",
          retryable: false,
          code: "bad_request",
        },
      }
    }

    const parts: string[] = []
    if (input.content.body) parts.push(input.content.body)
    if (input.content.hashtags?.length) {
      parts.push(input.content.hashtags.map((h) => `#${h}`).join(" "))
    }
    const caption = parts.join("\n\n")

    const createPayload: Record<string, any> = {
      caption,
      access_token: accessToken,
    }
    if (media.kind === "video") {
      createPayload.video_url = media.url
    } else {
      createPayload.image_url = media.url
    }

    // Step 1 — create the media container.
    let createRes: Response
    try {
      createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting Instagram: ${
            (e as Error).message
          }`,
          retryable: true,
          code: "network",
        },
      }
    }

    let createData: any = null
    try {
      createData = await createRes.json()
    } catch {
      createData = null
    }

    if (!createRes.ok) {
      const message =
        createData?.error?.message ??
        `Instagram responded with status ${createRes.status}`
      return mapHttpError(createRes.status, message)
    }

    const creationId = createData?.id
    if (!creationId) {
      return {
        ok: false,
        error: {
          message: "Instagram did not return a media creation id",
          retryable: true,
          code: "server",
        },
      }
    }

    // Step 2 — publish the container.
    let publishRes: Response
    try {
      publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error publishing to Instagram: ${
            (e as Error).message
          }`,
          retryable: true,
          code: "network",
        },
      }
    }

    let publishData: any = null
    try {
      publishData = await publishRes.json()
    } catch {
      publishData = null
    }

    if (!publishRes.ok) {
      const message =
        publishData?.error?.message ??
        `Instagram responded with status ${publishRes.status}`
      return mapHttpError(publishRes.status, message)
    }

    const id = publishData?.id ?? null
    return {
      ok: true,
      externalId: id != null ? String(id) : null,
      url: id != null ? `https://www.instagram.com/p/${id}` : null,
    }
  }
}

registerProvider(new InstagramProvider())
