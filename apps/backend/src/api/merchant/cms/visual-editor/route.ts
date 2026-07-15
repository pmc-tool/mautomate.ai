import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"

import { HostResolver } from "../../../../modules/platform/host-resolver"
import { resolveMerchant } from "../../_helpers"

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

/**
 * The token is BOUND to the minting merchant's tenant (`t`). The storefront
 * refuses it on any other store's domain — without this, a merchant's own
 * editor token was valid verbatim against every store on the platform
 * (publish, autosave, media, AI credits — all cross-tenant).
 */
function mintEditorToken(secret: string, tenantId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS, t: tenantId })
  ).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

function normalizeStorefront(raw: string): string | null {
  const trimmed = String(raw || "").trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    url.pathname = ""
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

/**
 * GET /merchant/cms/visual-editor?slug=home&locale=en&storefront=https://demo-store.mautomate.ai
 *
 * Merchant-facing entry point to the visual editor. Returns the signed key
 * and target path; the SPA constructs the cookie-gate URL on its own origin
 * so it always lands on the correct host (merchant.mautomate.ai or the
 * tenant's own domain), regardless of proxies/headers.
 *
 * Optional `storefront` query param: when supplied we validate the domain via
 * the control-plane HostResolver and return a ready-to-open `gate` URL that
 * bounces through /api/editor-auth on that storefront.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const slug = (req.query.slug as string) || "home"
  const locale = (req.query.locale as string) || "en"
  const requestedStorefront = normalizeStorefront(req.query.storefront as string)
  const secret = process.env.CMS_PREVIEW_SECRET || ""

  if (!secret) {
    return res.status(500).json({ message: "CMS preview secret is not configured" })
  }

  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "Merchant authentication required" })
  }

  const key = mintEditorToken(secret, ctx.tenant.id)
  const to = `/editor/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`

  const response: Record<string, string> = { key, to }

  if (requestedStorefront) {
    const requestedHost = new URL(requestedStorefront).host
    const resolver = new HostResolver(req.scope)
    const resolved = await resolver.resolve(requestedHost)
    if (!resolved) {
      return res.status(400).json({ message: "Storefront domain is not registered" })
    }
    if (resolved.status !== "live") {
      return res.status(400).json({ message: "Storefront is not live" })
    }
    // A merchant may only open the editor on THEIR OWN store's domains.
    if (resolved.tenant_id !== ctx.tenant.id) {
      return res.status(403).json({ message: "That storefront belongs to another store" })
    }
    response.gate =
      `${requestedStorefront.replace(/\/$/, "")}/api/editor-auth` +
      `?key=${encodeURIComponent(key)}&to=${encodeURIComponent(to)}`
  }

  res.json(response)
}
