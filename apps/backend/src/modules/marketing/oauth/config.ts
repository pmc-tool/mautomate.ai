/**
 * Per-platform OAuth wiring for the marketing connect flow. Covers only the
 * platforms whose publish adapter advertises `connect: "oauth"` (facebook,
 * instagram, x, linkedin). Meta (facebook/instagram) share one app; x uses PKCE.
 *
 * The client id/secret are read from env by NAME here (never stored) so the same
 * app credentials drive both `isConfigured()` on the provider and this flow.
 */

export type OAuthPlatform = "facebook" | "instagram" | "x" | "linkedin"

export type OAuthConfig = {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientIdEnv: string
  clientSecretEnv: string
  usePkce: boolean
}

const CONFIGS: Record<OAuthPlatform, OAuthConfig> = {
  facebook: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "business_management",
    ],
    clientIdEnv: "MARKETING_FACEBOOK_APP_ID",
    clientSecretEnv: "MARKETING_FACEBOOK_APP_SECRET",
    usePkce: false,
  },
  instagram: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "business_management",
    ],
    clientIdEnv: "MARKETING_FACEBOOK_APP_ID",
    clientSecretEnv: "MARKETING_FACEBOOK_APP_SECRET",
    usePkce: false,
  },
  x: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdEnv: "MARKETING_X_CLIENT_ID",
    clientSecretEnv: "MARKETING_X_CLIENT_SECRET",
    usePkce: true,
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"],
    clientIdEnv: "MARKETING_LINKEDIN_CLIENT_ID",
    clientSecretEnv: "MARKETING_LINKEDIN_CLIENT_SECRET",
    usePkce: false,
  },
}

/** The OAuth config for a platform, or null when it is not an OAuth platform. */
export const getOAuthConfig = (platform: string): OAuthConfig | null =>
  CONFIGS[platform as OAuthPlatform] ?? null

/** The backend callback URL Medusa exposes for a platform's OAuth redirect. */
export const buildRedirectUri = (platform: string): string => {
  const base =
    process.env.MARKETING_BACKEND_URL ??
    process.env.MEDUSA_BACKEND_URL ??
    "http://localhost:9000"
  return `${base.replace(/\/$/, "")}/marketing-oauth/${platform}/callback`
}
