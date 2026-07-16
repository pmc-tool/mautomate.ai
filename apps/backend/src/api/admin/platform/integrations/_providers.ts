/** Vendor integration registry — the single list the console + routes agree on. */
export const PLATFORM_SCOPE = "__platform__"

export type ProviderDef = {
  name: string
  category: string
  env: string // the env var / secret key this provider's credential maps to
  scope: string
  test?: "openai" | "elevenlabs" | "deepgram" | "stripe" | "cloudflare"
  /** One-line guidance: where to get this key. Shown in the console. */
  help?: string
  /** Deep link to the provider's developer console / docs. */
  docs?: string
  /** Whether this value is a secret (mask it in the UI). */
  secret?: boolean
}

/**
 * Ordered by category so the console renders clean, grouped sections. Each
 * social/messaging credential carries `help` + `docs` so the operator knows
 * exactly where to obtain it.
 */
export const PROVIDERS: ProviderDef[] = [
  // --- AI ---
  { name: "OpenAI API Key", category: "AI", env: "OPENAI_API_KEY", scope: "platform", test: "openai", secret: true, help: "platform.openai.com → API keys.", docs: "https://platform.openai.com/api-keys" },
  { name: "ElevenLabs API Key", category: "AI", env: "ELEVENLABS_API_KEY", scope: "platform", test: "elevenlabs", secret: true, help: "elevenlabs.io → Profile → API key.", docs: "https://elevenlabs.io/app/settings/api-keys" },
  { name: "Deepgram API Key", category: "AI", env: "DEEPGRAM_API_KEY", scope: "platform", test: "deepgram", secret: true, help: "console.deepgram.com → API keys.", docs: "https://console.deepgram.com/" },

  // --- Telephony ---
  { name: "Twilio Auth Token", category: "Telephony & SMS", env: "TWILIO_AUTH_TOKEN", scope: "platform", secret: true, help: "console.twilio.com → Account Info.", docs: "https://console.twilio.com/" },

  // --- Payments ---
  { name: "Stripe Secret Key", category: "Payments", env: "STRIPE_SECRET_KEY", scope: "platform", test: "stripe", secret: true, help: "dashboard.stripe.com → Developers → API keys.", docs: "https://dashboard.stripe.com/apikeys" },
  { name: "SSLCommerz Store ID", category: "Payments", env: "SSLCOMMERZ_STORE_ID", scope: "platform", help: "SSLCommerz merchant panel → API/Integration." },
  { name: "SSLCommerz Store Password", category: "Payments", env: "SSLCOMMERZ_STORE_PASSWD", scope: "platform", secret: true, help: "SSLCommerz merchant panel → API/Integration." },

  // --- Domains & Email ---
  { name: "Cloudflare API Token", category: "Domains & Email", env: "CLOUDFLARE_API_TOKEN", scope: "platform", test: "cloudflare", secret: true, help: "dash.cloudflare.com → My Profile → API Tokens.", docs: "https://dash.cloudflare.com/profile/api-tokens" },
  { name: "ResellerClub API Key", category: "Domains & Email", env: "RESELLERCLUB_API_KEY", scope: "platform", secret: true, help: "ResellerClub control panel → Settings → API." },
  { name: "SMTP Password", category: "Domains & Email", env: "SMTP_PASS", scope: "platform/tenant", secret: true, help: "From your email/SMTP provider." },

  // --- Social: Facebook & Instagram (one Meta app powers both) ---
  { name: "Facebook App ID", category: "Social · Facebook & Instagram", env: "MARKETING_FACEBOOK_APP_ID", scope: "platform", help: "Create an app at Meta for Developers, then App → Settings → Basic → App ID.", docs: "https://developers.facebook.com/apps" },
  { name: "Facebook App Secret", category: "Social · Facebook & Instagram", env: "MARKETING_FACEBOOK_APP_SECRET", scope: "platform", secret: true, help: "Same Meta app → Settings → Basic → App Secret.", docs: "https://developers.facebook.com/apps" },
  { name: "Instagram App Secret", category: "Social · Facebook & Instagram", env: "MARKETING_INSTAGRAM_APP_SECRET", scope: "platform", secret: true, help: "Meta app → add Instagram → Instagram Graph API. Often the same App Secret.", docs: "https://developers.facebook.com/apps" },
  { name: "Instagram Webhook Verify Token", category: "Social · Facebook & Instagram", env: "MARKETING_INSTAGRAM_VERIFY_TOKEN", scope: "platform", secret: true, help: "A random string you choose; paste the same value into the Meta webhook config." },

  // --- Social: LinkedIn ---
  { name: "LinkedIn Client ID", category: "Social · LinkedIn", env: "MARKETING_LINKEDIN_CLIENT_ID", scope: "platform", help: "Create an app at LinkedIn Developers → Auth → Client ID.", docs: "https://www.linkedin.com/developers/apps" },
  { name: "LinkedIn Client Secret", category: "Social · LinkedIn", env: "MARKETING_LINKEDIN_CLIENT_SECRET", scope: "platform", secret: true, help: "Same LinkedIn app → Auth → Client Secret.", docs: "https://www.linkedin.com/developers/apps" },

  // --- Social: X (Twitter) ---
  { name: "X (Twitter) Client ID", category: "Social · X (Twitter)", env: "MARKETING_X_CLIENT_ID", scope: "platform", help: "X Developer Portal → your app → Keys and tokens → OAuth 2.0 Client ID.", docs: "https://developer.x.com/en/portal/dashboard" },
  { name: "X (Twitter) Client Secret", category: "Social · X (Twitter)", env: "MARKETING_X_CLIENT_SECRET", scope: "platform", secret: true, help: "Same X app → Keys and tokens → OAuth 2.0 Client Secret.", docs: "https://developer.x.com/en/portal/dashboard" },

  // --- Messaging: WhatsApp ---
  { name: "WhatsApp App Secret", category: "Messaging · WhatsApp", env: "MARKETING_WHATSAPP_APP_SECRET", scope: "platform", secret: true, help: "Meta app → WhatsApp → API Setup; App Secret is under Settings → Basic.", docs: "https://developers.facebook.com/apps" },
  { name: "WhatsApp Webhook Verify Token", category: "Messaging · WhatsApp", env: "MARKETING_WHATSAPP_VERIFY_TOKEN", scope: "platform", secret: true, help: "A random string you choose; paste the same value into the WhatsApp webhook config." },

  // --- Messaging: Messenger ---
  { name: "Messenger App Secret", category: "Messaging · Messenger", env: "MARKETING_MESSENGER_APP_SECRET", scope: "platform", secret: true, help: "Meta app → Messenger settings; App Secret is under Settings → Basic.", docs: "https://developers.facebook.com/apps" },
  { name: "Messenger Webhook Verify Token", category: "Messaging · Messenger", env: "MARKETING_MESSENGER_VERIFY_TOKEN", scope: "platform", secret: true, help: "A random string you choose; paste the same value into the Messenger webhook config." },

  // --- Ads: Google (apply for the token NOW — approval is slow; the merchant
  //     integration switches on when it reaches Basic access) ---
  { name: "Google Ads Developer Token", category: "Ads · Google Ads", env: "GOOGLE_ADS_DEVELOPER_TOKEN", scope: "platform", secret: true, help: "Google Ads MANAGER account → Admin → API Center. Starts as test-level; apply for Basic access.", docs: "https://developers.google.com/google-ads/api/docs/api-policy/access-levels" },
  { name: "Google OAuth Client ID", category: "Ads · Google Ads", env: "GOOGLE_ADS_CLIENT_ID", scope: "platform", help: "Google Cloud Console → Credentials → OAuth client (Web application).", docs: "https://console.cloud.google.com/apis/credentials" },
  { name: "Google OAuth Client Secret", category: "Ads · Google Ads", env: "GOOGLE_ADS_CLIENT_SECRET", scope: "platform", secret: true, help: "Same OAuth client → Client Secret.", docs: "https://console.cloud.google.com/apis/credentials" },
]

export const byEnv = (env: string) => PROVIDERS.find((p) => p.env === env)

/** Run a real, minimal auth probe for a provider that supports one. */
export async function testProvider(
  kind: ProviderDef["test"],
  key: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (kind === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } })
      return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }
    }
    if (kind === "elevenlabs") {
      const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } })
      return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }
    }
    if (kind === "deepgram") {
      const r = await fetch("https://api.deepgram.com/v1/projects", { headers: { Authorization: `Token ${key}` } })
      return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }
    }
    if (kind === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } })
      return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }
    }
    if (kind === "cloudflare") {
      const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: `Bearer ${key}` } })
      return { ok: r.ok, message: r.ok ? "Token valid" : `HTTP ${r.status}` }
    }
    return { ok: false, message: "No automated test for this provider" }
  } catch (e: any) {
    return { ok: false, message: e?.message || "Test request failed" }
  }
}
