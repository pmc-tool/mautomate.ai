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
/**
 * Verify a signed editor token's signature + expiry and return its payload
 * (`exp`, and `t` = the tenant the token was minted for), or null.
 */
export function editorKeyPayload(
  provided: string | null | undefined
): { exp: number; t?: string } | null {
  const secret = process.env.CMS_PREVIEW_SECRET
  if (!secret || typeof provided !== "string" || !provided) {
    return null
  }
  const dot = provided.lastIndexOf(".")
  if (dot <= 0) {
    return null
  }
  const payloadB64 = provided.slice(0, dot)
  const sig = provided.slice(dot + 1)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url")
  if (!safeKeyEqual(sig, expected)) {
    return null
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    )
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null
    }
    return {
      exp: payload.exp,
      ...(typeof payload.t === "string" && payload.t ? { t: payload.t } : {}),
    }
  } catch {
    return null
  }
}

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
  return editorKeyPayload(provided) !== null
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

const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

/**
 * Gate an editor API request: the query key OR the session cookie must hold a
 * valid signed token, AND — in multi-tenant mode — that token must be BOUND
 * (`t` in its payload) to the tenant that owns the domain the request came in
 * on. Without the binding, a merchant's own editor token was valid verbatim
 * against every other store on the platform: publish, autosave, media upload
 * and AI-credit spend, all cross-tenant. Tokens without `t` (minted before
 * this fix) are refused in multi-tenant mode — re-open the editor to get a
 * bound one.
 */
export async function isValidEditorRequest(req: NextRequest): Promise<boolean> {
  return isValidEditorKeyForRequest(getEditorKeyFromRequest(req), req)
}

/**
 * Same gate for an EXPLICIT key (the /api/editor-auth cookie seeder validates
 * the ?key= it is about to store, so a cross-store gate URL fails at the door
 * instead of planting a cookie that every later request would refuse anyway).
 */
export async function isValidEditorKeyForRequest(
  provided: string | null | undefined,
  req: NextRequest
): Promise<boolean> {
  const secret = process.env.CMS_PREVIEW_SECRET
  if (!secret || !provided) {
    return false
  }
  // Dev raw-secret path (never enabled in production).
  if (process.env.NODE_ENV !== "production" && safeKeyEqual(provided, secret)) {
    return true
  }
  const payload = editorKeyPayload(provided)
  if (!payload) {
    return false
  }
  if (!MULTI_TENANT) {
    return true
  }
  if (!payload.t) {
    return false
  }
  const { resolveEditorTenant } = await import("./editor-tenant")
  const tenant = await resolveEditorTenant(req)
  return !!tenant.tenantId && payload.t === tenant.tenantId
}
