import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { PROVIDERS, PLATFORM_SCOPE } from "./_providers"

/**
 * GET /admin/platform/integrations — vendor credential status. A provider is
 * "configured" if its key is set in the env OR the encrypted platform config
 * store (keys written from this console land in the encrypted store).
 */
const CONNECT_BASE = (
  process.env.MARKETING_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  ""
).replace(/\/$/, "")

/**
 * The OAuth redirect URI (or webhook URL) the operator must register in the
 * provider's developer app, derived from the public backend URL + platform.
 */
function connectUrlFor(env: string): string | null {
  if (!CONNECT_BASE) return null
  if (env.startsWith("MARKETING_FACEBOOK")) return `${CONNECT_BASE}/marketing-oauth/facebook/callback`
  if (env.startsWith("MARKETING_INSTAGRAM")) return `${CONNECT_BASE}/marketing-oauth/instagram/callback`
  if (env.startsWith("MARKETING_LINKEDIN")) return `${CONNECT_BASE}/marketing-oauth/linkedin/callback`
  if (env.startsWith("MARKETING_X_")) return `${CONNECT_BASE}/marketing-oauth/x/callback`
  if (env.startsWith("MARKETING_WHATSAPP")) return `${CONNECT_BASE}/marketing-webhooks/whatsapp`
  if (env.startsWith("MARKETING_MESSENGER")) return `${CONNECT_BASE}/marketing-webhooks/messenger`
  return null
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cfg = new EncryptedConfigService(req.scope)
  const providers = await Promise.all(
    PROVIDERS.map(async (p) => {
      let stored = false
      try {
        stored = (await cfg.getSecret(PLATFORM_SCOPE, p.env)) !== undefined
      } catch {
        /* KEK unset or read error → treat as not stored */
      }
      const envSet = !!process.env[p.env]
      return {
        name: p.name,
        category: p.category,
        env: p.env,
        scope: p.scope,
        testable: !!p.test,
        configured: envSet || stored,
        source: stored ? "vault" : envSet ? "env" : null,
        help: p.help ?? null,
        docs: p.docs ?? null,
        secret: p.secret ?? false,
        connect_url: connectUrlFor(p.env),
      }
    })
  )
  res.json({ providers })
}
