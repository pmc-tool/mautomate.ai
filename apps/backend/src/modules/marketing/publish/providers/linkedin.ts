/**
 * LinkedIn publish adapter — posts a UGC post via the v2 API with a per-account
 * OAuth2 bearer token. The APP-level integration is gated on the LinkedIn
 * client id/secret env.
 *
 * NOTE: Posting on behalf of an ORGANIZATION (urn:li:organization:*) requires
 * LinkedIn app review of the Community Management / w_organization_social
 * product (RED-gated). This adapter is COMPLETE and will work as-is once the
 * per-account credentials and that approval exist; personal-member posting
 * (urn:li:person:*) works with the standard w_member_social scope.
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

class LinkedinProvider implements PublishProvider {
  readonly platform = "linkedin" as const
  readonly label = "LinkedIn"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: 3000,
    supportsHashtags: true,
    supportsScheduling: false,
    connect: "oauth" as const,
  }

  isConfigured(): boolean {
    return (
      !!process.env.MARKETING_LINKEDIN_CLIENT_ID &&
      !!process.env.MARKETING_LINKEDIN_CLIENT_SECRET
    )
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const meta = input.credentials.meta ?? {}
    const accessToken = input.credentials.accessToken
    const orgId = meta.org_id as string | undefined
    const author = orgId
      ? `urn:li:organization:${orgId}`
      : input.account.external_id
      ? `urn:li:person:${input.account.external_id}`
      : null

    if (!accessToken || !author) {
      return {
        ok: false,
        error: {
          message: "Missing LinkedIn access token or author urn",
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

    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }

    let res: Response
    try {
      res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      return {
        ok: false,
        error: {
          message: `Network error contacting LinkedIn: ${
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
        data?.message ?? `LinkedIn responded with status ${res.status}`
      return mapHttpError(res.status, message)
    }

    const urn =
      data?.id ?? res.headers.get("x-restli-id") ?? null
    return {
      ok: true,
      externalId: urn != null ? String(urn) : null,
      url:
        urn != null
          ? `https://www.linkedin.com/feed/update/${urn}`
          : null,
    }
  }
}

registerProvider(new LinkedinProvider())
