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
    let loaded = 0
    let failed = 0
    for (const key of MARKETING_SOCIAL_ENVS) {
      if (process.env[key]) {
        loaded++ // a real env var wins, and counts as a successful resolution
        continue
      }
      try {
        const val = await cfg.getSecret(PLATFORM_SCOPE, key)
        if (val) {
          process.env[key] = val
          loaded++
        }
      } catch {
        failed++ // KEK unset / decrypt error for THIS key
      }
    }
    /* Only latch when the vault actually answered. The old code set
       `hydrated` unconditionally, so ONE bad moment (KEK not yet mounted, DB
       not ready during boot) poisoned the process for its whole life: every
       later request skipped the vault, every provider reported unconfigured,
       and the merchant saw "awaiting the operator adding this platform's app
       credentials" even though the keys were sitting in the vault. Retry
       instead — the read is cheap and only happens until it works. */
    if (loaded > 0 || failed === 0) hydrated = true
  } catch {
    /* leave unhydrated; retry next call */
  }
}
