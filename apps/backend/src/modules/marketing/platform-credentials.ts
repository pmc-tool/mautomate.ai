/**
 * Hydrate platform social/messaging APP keys from the super-admin vault into
 * `process.env` so the marketing providers (which read `process.env.MARKETING_*`)
 * pick them up.
 *
 * Source of truth is the SAME encrypted vault the super-admin console writes to
 * via `POST /admin/platform/integrations/:env` (EncryptedConfigService, platform
 * scope). A real server env var always WINS, so ops can still override. DB → env,
 * cached once per process (re-run after a save with `invalidatePlatformEnv`).
 */
import { EncryptedConfigService } from "../platform/secure-config"

/** Platform scope key used by the integrations vault. */
const PLATFORM_SCOPE = "__platform__"

/** The social/messaging APP-credential env keys the marketing providers read. */
export const MARKETING_SOCIAL_ENVS = [
  "MARKETING_FACEBOOK_APP_ID",
  "MARKETING_FACEBOOK_APP_SECRET",
  "MARKETING_INSTAGRAM_APP_SECRET",
  "MARKETING_INSTAGRAM_VERIFY_TOKEN",
  "MARKETING_MESSENGER_APP_SECRET",
  "MARKETING_MESSENGER_VERIFY_TOKEN",
  "MARKETING_WHATSAPP_APP_SECRET",
  "MARKETING_WHATSAPP_VERIFY_TOKEN",
  "MARKETING_LINKEDIN_CLIENT_ID",
  "MARKETING_LINKEDIN_CLIENT_SECRET",
  "MARKETING_X_CLIENT_ID",
  "MARKETING_X_CLIENT_SECRET",
]

let hydrated = false

/** Force a re-hydration on the next call (after a super-admin saves a key). */
export const invalidatePlatformEnv = (): void => {
  hydrated = false
}

/**
 * Load the vault-stored social keys into `process.env`. Takes the request/DI
 * container (scope). No-throw and best-effort: a missing KEK or one bad key
 * never blocks the flow. Runs at most once per process until invalidated.
 */
export const ensurePlatformEnv = async (container: any): Promise<void> => {
  if (hydrated) return
  try {
    const cfg = new EncryptedConfigService(container)
    for (const key of MARKETING_SOCIAL_ENVS) {
      if (process.env[key]) continue // a real env var wins
      try {
        const val = await cfg.getSecret(PLATFORM_SCOPE, key)
        if (val) process.env[key] = val
      } catch {
        /* KEK unset / decrypt error → skip this key */
      }
    }
    hydrated = true
  } catch {
    /* leave unhydrated; retry next call */
  }
}
