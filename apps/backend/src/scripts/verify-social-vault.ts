import { EncryptedConfigService } from "../modules/platform/secure-config"
import {
  ensurePlatformEnv,
  invalidatePlatformEnv,
} from "../modules/marketing/platform-credentials"
import { getPublishProvider } from "../modules/marketing/publish"
import { PROVIDERS, byEnv } from "../api/admin/platform/integrations/_providers"

const SCOPE = "__platform__"

export default async function verifySocialVault({ container }: any) {
  const cfg = new EncryptedConfigService(container)
  const checks: [string, boolean][] = []

  // 0. The social providers are now in the console's integrations registry.
  checks.push([
    "Facebook keys registered in PROVIDERS (console will show them)",
    !!byEnv("MARKETING_FACEBOOK_APP_ID") &&
      !!byEnv("MARKETING_FACEBOOK_APP_SECRET"),
  ])
  const socialCount = PROVIDERS.filter((p) =>
    p.env.startsWith("MARKETING_")
  ).length
  console.log(`[social] ${socialCount} social/messaging providers now listed`)

  // 1. Simulate a super-admin saving keys in the console (writes to the vault).
  await cfg.setSecret(SCOPE, "MARKETING_FACEBOOK_APP_ID", "111222333")
  await cfg.setSecret(SCOPE, "MARKETING_FACEBOOK_APP_SECRET", "vault_secret_xyz")

  // 2. Fresh process: wipe env + cache, hydrate from the vault.
  delete process.env.MARKETING_FACEBOOK_APP_ID
  delete process.env.MARKETING_FACEBOOK_APP_SECRET
  invalidatePlatformEnv()
  await ensurePlatformEnv(container)

  checks.push([
    "vault keys hydrated into process.env",
    process.env.MARKETING_FACEBOOK_APP_ID === "111222333" &&
      process.env.MARKETING_FACEBOOK_APP_SECRET === "vault_secret_xyz",
  ])

  // 3. The Facebook provider now reports configured.
  const fb: any = getPublishProvider("facebook")
  checks.push(["facebook provider isConfigured() true", !!fb && fb.isConfigured()])

  // 4. Cleanup.
  await cfg.deleteKey(SCOPE, "MARKETING_FACEBOOK_APP_ID").catch(() => {})
  await cfg.deleteKey(SCOPE, "MARKETING_FACEBOOK_APP_SECRET").catch(() => {})

  let pass = true
  for (const [n, c] of checks) {
    console.log(`[social] ${c ? "PASS" : "FAIL"} — ${n}`)
    if (!c) pass = false
  }
  console.log(`[social] OVERALL ${pass ? "PASS" : "FAIL"}`)
}
