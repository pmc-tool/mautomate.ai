/**
 * Shared CORS helper for the public web-chat API (`/marketing-chat/*`).
 * The `_` prefix keeps Medusa's file-based router from mounting this as a route.
 *
 * WHY `*` AND NOT THE STORE_CORS ALLOWLIST: the chat widget is EMBEDDABLE — a
 * merchant pastes `widget.js` into any site they own (their mAutomate storefront,
 * a WordPress blog, a landing page), so the set of legitimate origins is open by
 * design and cannot be enumerated in STORE_CORS. That is safe here because these
 * endpoints carry NO ambient authority: no cookies, no credentials (the widget
 * fetches with `mode: "cors"` and never `credentials: "include"`), and every call
 * is gated by a secret the caller must already hold — the chatbot's public embed
 * key (/config, /session) or the opaque conversation token (/message, /messages).
 * A cross-origin page can therefore learn nothing it could not learn by calling
 * the endpoint from its own server. `Access-Control-Allow-Credentials` is never
 * sent, so a browser will refuse to attach cookies to these requests.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/** Set the CORS response headers. Call at the top of every chat handler. */
export const applyCors = (_req: MedusaRequest, res: MedusaResponse): void => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-chatbot-key")
  res.setHeader("Access-Control-Max-Age", "86400")
}

/** Standard preflight responder — export as `OPTIONS` from each route. */
export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  applyCors(req, res)
  res.status(204).send("")
}
