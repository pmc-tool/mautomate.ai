import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import crypto from "crypto"

import { HostResolver } from "../../../../modules/platform/host-resolver"

/** Editor tokens are valid for this long once minted. */
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

/**
 * The public origin the request came in on (the store's own domain), from the
 * proxy's forwarded headers. Returns "" for internal/localhost hosts so the
 * caller falls back to STOREFRONT_URL (local/single-tenant dev).
 */
export function publicOrigin(req: { headers: Record<string, any> }): string {
  const host = String(req.headers["x-forwarded-host"] || req.headers["host"] || "")
    .split(",")[0]
    .trim()
  if (!host || /^(localhost|127\.|0\.0\.0\.0|\[?::1)/i.test(host)) return ""
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim()
  return `${proto}://${host}`
}

/**
 * Mint a short-lived, signed editor key: `<payloadB64>.<hmac>`. The storefront
 * validates it with the same CMS_PREVIEW_SECRET (see isValidEditorKey). A leaked
 * editor URL stops working once the embedded `exp` passes, instead of granting
 * permanent access like the raw secret did.
 */
function mintEditorToken(secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url")
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url")
  return `${payload}.${sig}`
}

/**
 * Normalize a caller-supplied storefront origin. Strips trailing slashes and
 * requires a plain http(s) URL. Returns null for anything suspicious.
 */
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
 * GET /admin/cms/visual-editor?slug=home&locale=en&storefront=https://demo-store.mautomate.ai
 *
 * Redirects an authenticated admin to the storefront visual editor, handing
 * over a short-lived signed editor token server-side (the secret never ships in
 * the admin bundle). Gated by the /admin/cms/* auth middleware, so only
 * authenticated admins can mint a token.
 *
 * Multi-tenant fix: the caller MUST pass the target tenant's storefront origin
 * via the `storefront` query param. We validate that origin against the
 * control-plane HostResolver so admins can only open the editor for stores they
 * actually manage. Without `storefront` we fall back to the legacy behavior
 * (publicOrigin / STOREFRONT_URL) so single-tenant dev keeps working.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const slug = (req.query.slug as string) || "home"
  const locale = (req.query.locale as string) || "en"
  const requestedStorefront = normalizeStorefront(req.query.storefront as string)

  let storefront = publicOrigin(req) || process.env.STOREFRONT_URL || "http://localhost:8000"

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
    storefront = requestedStorefront
  }

  const secret = process.env.CMS_PREVIEW_SECRET || ""
  if (!secret) {
    return res.status(500).json({ message: "CMS preview secret is not configured" })
  }
  const key = mintEditorToken(secret)

  // Bounce through the storefront's cookie gate: /api/editor-auth stores the
  // token in an httpOnly session cookie and redirects to `to`, so the editor
  // URL the admin lands on never carries the key.
  const to =
    `/editor/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`
  const target =
    `${storefront.replace(/\/$/, "")}/api/editor-auth` +
    `?key=${encodeURIComponent(key)}&to=${encodeURIComponent(to)}`

  res.redirect(target)
}
