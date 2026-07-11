/**
 * Shared CORS helper for the public storefront web-chat API (`/marketing-chat/*`).
 * The `_` prefix keeps Medusa's file-based router from mounting this as a route.
 *
 * The widget is embedded on the storefront origin, so these endpoints are
 * cross-origin. We echo the request `Origin` when it appears in `STORE_CORS`
 * (comma-separated allowlist); otherwise we fall back to the first configured
 * origin, or `*` when `STORE_CORS` is unset (dev). Only content-type is needed
 * on the request — the API is gated by an opaque conversation token in the body,
 * not by cookies/credentials.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const resolveAllowOrigin = (req: MedusaRequest): string => {
  const origin =
    typeof req.headers.origin === "string" ? req.headers.origin : undefined
  const allowed = (process.env.STORE_CORS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (!allowed.length) {
    return origin ?? "*"
  }
  if (origin && allowed.includes(origin)) {
    return origin
  }
  return allowed[0]
}

/** Set the CORS response headers. Call at the top of every chat handler. */
export const applyCors = (req: MedusaRequest, res: MedusaResponse): void => {
  res.setHeader("Access-Control-Allow-Origin", resolveAllowOrigin(req))
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "content-type")
  res.setHeader("Access-Control-Max-Age", "86400")
}

/** Standard preflight responder — export as `OPTIONS` from each route. */
export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  applyCors(req, res)
  res.status(204).send("")
}
