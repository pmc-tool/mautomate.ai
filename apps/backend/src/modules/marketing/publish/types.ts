/**
 * Publish provider contract — the fixed seam every platform adapter implements
 * and the runner + connect UI depend on. One `PublishProvider` per platform
 * (facebook, instagram, x, linkedin, wordpress, telegram, …). Adapters own the
 * network specifics; the runner owns scheduling, claiming, retries, and status.
 *
 * Design rules:
 *  - Adapters are STATELESS: everything they need arrives in `PublishInput`.
 *  - Adapters NEVER read env for per-account secrets — those come decrypted in
 *    `input.credentials`. `isConfigured()` only reports whether the APP-level
 *    integration (client id/secret, or "this provider needs no app keys") is
 *    present, which drives the "Connect your app" vs "Connect account" UI.
 *  - Adapters do not throw for expected publish failures — they return a
 *    `PublishResult` with `ok:false` and a `retryable` flag. They may throw only
 *    for programmer errors; the runner treats a throw as a non-retryable failure.
 */

/** The platform identifiers shared across models, providers, and UI. */
export type PublishPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "tiktok"
  | "x"
  | "wordpress"
  | "pinterest"
  | "threads"
  | "telegram"

/** Decrypted credentials for a single connected account. */
export type ProviderCredentials = {
  accessToken: string | null
  refreshToken: string | null
  tokenType: string | null
  expiresAt: Date | null
  /** Provider-specific extras (e.g. wordpress site_url, page_id, ig_user_id). */
  meta: Record<string, any> | null
}

/** A media asset attached to the post, already resolved to a public URL. */
export type ProviderMedia = {
  url: string
  kind: "image" | "video"
  alt: string | null
}

/** Everything an adapter needs to publish one target. Fully self-contained. */
export type PublishInput = {
  tenantId: string
  /** The connected account row (external_id, handle, meta live here). */
  account: {
    id: string
    external_id: string | null
    handle: string | null
    meta: Record<string, any> | null
  }
  credentials: ProviderCredentials
  /** The resolved copy for THIS platform (override already applied by runner). */
  content: {
    /** Final body text to post (target override or master body). */
    body: string | null
    /** Final hashtags (array). */
    hashtags: string[] | null
    /** Optional link to include (post link_url). */
    link: string | null
    /** Optional title (used by wordpress/youtube). */
    title: string | null
  }
  media: ProviderMedia[]
}

/** The outcome of a publish attempt. */
export type PublishResult = {
  ok: boolean
  /** Provider's id for the created post (stored as external_post_id). */
  externalId?: string | null
  /** Canonical public URL of the created post (stored as external_url). */
  url?: string | null
  /** Present when ok:false. `retryable` drives the runner's backoff. */
  error?: {
    message: string
    retryable: boolean
    /** e.g. "auth" (token dead → mark account expired), "rate_limit", "bad_request". */
    code?: string
  }
}

/** Static description of a provider's constraints, for UI + pre-flight checks. */
export type ProviderCapabilities = {
  /** Whether media is required, optional, or unsupported for a post. */
  media: "required" | "optional" | "none"
  /** Hard character ceiling for the body, or null if effectively unlimited. */
  maxTextLength: number | null
  supportsHashtags: boolean
  supportsScheduling: boolean
  /** How the account is connected: "oauth" or "app_password" (wordpress). */
  connect: "oauth" | "app_password" | "webhook_token"
}

/** The interface every platform adapter implements. */
export interface PublishProvider {
  readonly platform: PublishPlatform
  readonly label: string
  readonly capabilities: ProviderCapabilities
  /**
   * Whether the APP-level integration is configured (client keys present, or
   * the provider needs none). Drives the connect UX; NOT per-account auth.
   */
  isConfigured(): boolean
  /** Attempt to publish one target. Never throws for expected failures. */
  publish(input: PublishInput): Promise<PublishResult>
}
