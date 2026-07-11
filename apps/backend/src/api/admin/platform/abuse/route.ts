import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PER_IP_LIMIT, GLOBAL_LIMIT, WINDOW_MS } from "../../../../modules/platform/abuse/quota"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { PROVIDERS, PLATFORM_SCOPE } from "../integrations/_providers"

/** GET /admin/platform/abuse — fleet AI status + signup abuse controls. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cfg = new EncryptedConfigService(req.scope)
  const aiProviders = PROVIDERS.filter((p) => p.category.startsWith("AI") || p.name === "Twilio")
  const ai = await Promise.all(
    aiProviders.map(async (p) => {
      let stored = false
      try { stored = (await cfg.getSecret(PLATFORM_SCOPE, p.env)) !== undefined } catch { /* */ }
      return { name: p.name, category: p.category, configured: !!process.env[p.env] || stored }
    })
  )
  res.json({
    ai,
    signup_open: process.env.SIGNUP_ENABLED === "true",
    quota: { per_ip_per_hour: PER_IP_LIMIT, global_per_hour: GLOBAL_LIMIT, window_hours: WINDOW_MS / 3600000 },
  })
}
