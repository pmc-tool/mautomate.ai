import crypto from "crypto"
import type { NextRequest } from "next/server"

/**
 * Name of the httpOnly session cookie holding the editor key. Seeded by
 * GET /api/editor-auth from the admin-minted expiring token, so the key no
 * longer has to travel in every URL (?key= still wins when present).
 */
export const EDITOR_KEY_COOKIE = "ff_editor_key"

/**
 * Constant-time comparison of a caller-provided key against a configured secret.
 * Both inputs are hashed to a fixed-length digest first, so neither the value
 * nor its length leaks through timing or an early length-mismatch return.
 * Returns false when the secret is unset or the provided value is not a string.
 */
export function safeKeyEqual(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!expected || typeof provided !== "string") {
    return false
  }
  const a = crypto.createHash("sha256").update(provided, "utf8").digest()
  const b = crypto.createHash("sha256").update(expected, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(a), Uint8Array.from(b))
}

/**
 * Validate a visual-editor access key. Accepts either:
 *  - a short-lived signed token `<payloadB64>.<hmac>` issued by the admin
 *    redirect (payload carries `exp`; rejected once expired), OR
 *  - the raw CMS_PREVIEW_SECRET — DEV ONLY (direct `?key=<secret>` use).
 *
 * In production the raw-secret path is disabled: only the expiring signed token
 * is accepted, so a leaked editor URL always stops working after it expires
 * instead of granting permanent access. The admin redirect
 * (`/admin/cms/visual-editor`) mints those tokens behind real admin auth, so
 * production access never needs the raw secret.
 */
export function isValidEditorKey(provided: string | null | undefined): boolean {
  const secret = process.env.CMS_PREVIEW_SECRET
  if (!secret || typeof provided !== "string" || !provided) {
    return false
  }
  // Legacy / dev convenience: the raw secret. Disabled in production so a leaked
  // URL cannot grant permanent access — prod requires the expiring signed token.
  if (process.env.NODE_ENV !== "production" && safeKeyEqual(provided, secret)) {
    return true
  }
  // Signed, expiring token.
  const dot = provided.lastIndexOf(".")
  if (dot <= 0) {
    return false
  }
  const payloadB64 = provided.slice(0, dot)
  const sig = provided.slice(dot + 1)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url")
  if (!safeKeyEqual(sig, expected)) {
    return false
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    )
    return typeof payload.exp === "number" && payload.exp > Date.now()
  } catch {
    return false
  }
}

/**
 * Extract the editor key from a request: the explicit ?key= query param wins
 * (dev raw-secret use + backward compat with keyed URLs), otherwise fall back
 * to the ff_editor_key session cookie seeded by /api/editor-auth. Returns null
 * when neither carries a non-empty value.
 */
export function getEditorKeyFromRequest(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get("key")
  if (fromQuery) {
    return fromQuery
  }
  return req.cookies.get(EDITOR_KEY_COOKIE)?.value || null
}

/**
 * Gate an editor API request: valid when the query key OR the session cookie
 * holds a key that passes isValidEditorKey. Expired cookies simply fail
 * validation, so a stale session degrades to today's 401 behavior.
 */
export function isValidEditorRequest(req: NextRequest): boolean {
  return isValidEditorKey(getEditorKeyFromRequest(req))
}
