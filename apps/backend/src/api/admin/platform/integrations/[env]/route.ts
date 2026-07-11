import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EncryptedConfigService } from "../../../../../modules/platform/secure-config"
import { PLATFORM_SCOPE, byEnv, testProvider } from "../_providers"

/**
 * POST /admin/platform/integrations/:env
 *   { value }            → store an encrypted key
 *   { action: "test" }   → probe the provider auth with the stored/env key
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const env = req.params.env
  const provider = byEnv(env)
  if (!provider) return res.status(404).json({ message: "unknown provider" })
  const body = (req.body ?? {}) as { value?: string; action?: string }
  const cfg = new EncryptedConfigService(req.scope)

  if (body.action === "test") {
    if (!provider.test) return res.json({ ok: false, message: "No automated test for this provider" })
    let key: string | undefined
    try { key = await cfg.getSecret(PLATFORM_SCOPE, env) } catch { /* */ }
    key = key || process.env[env]
    if (!key) return res.json({ ok: false, message: "No key set" })
    return res.json(await testProvider(provider.test, key))
  }

  const value = String(body.value ?? "").trim()
  if (!value) return res.status(400).json({ message: "value required" })
  await cfg.setSecret(PLATFORM_SCOPE, env, value)
  res.json({ env, configured: true, source: "vault" })
}

/** DELETE /admin/platform/integrations/:env — clear a stored key. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const env = req.params.env
  if (!byEnv(env)) return res.status(404).json({ message: "unknown provider" })
  const cfg = new EncryptedConfigService(req.scope)
  await cfg.deleteKey(PLATFORM_SCOPE, env)
  res.json({ env, configured: !!process.env[env] })
}
