/**
 * Tracking tokens — the primitives behind the FIRST-PARTY open / click /
 * unsubscribe URLs (all served from the store's own domain). Two kinds:
 *
 *  1. A per-send opaque random token (stored on marketing_email_send.token) —
 *     used to look a send up for open/click accounting.
 *  2. HMAC-signed payloads — self-contained, tamper-proof links that need no DB
 *     lookup: the signed click destination (prevents open-redirect abuse) and
 *     the unsubscribe token (carries contact_id + email).
 *
 * Secret: MARKETING_SECRET_KEY (same key the credential vault uses). If unset,
 * a clearly-marked ephemeral dev fallback is used so links still function in
 * development — set the env in production.
 */

import crypto from "crypto"

const secret = (): string =>
  process.env.MARKETING_SECRET_KEY ||
  process.env.MARKETING_TRACKING_SECRET ||
  process.env.JWT_SECRET ||
  "dev-insecure-marketing-tracking-secret"

const b64url = (b: Buffer): string =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const unb64url = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const hmac = (data: string): string =>
  b64url(crypto.createHmac("sha256", secret()).update(data).digest())

/** A fresh unguessable per-send token. */
export const makeSendToken = (): string =>
  b64url(crypto.randomBytes(18))

/** Sign an arbitrary JSON payload → `<payload>.<sig>` (tamper-proof). */
export const signPayload = (payload: Record<string, unknown>): string => {
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  return `${body}.${hmac(body)}`
}

/** Verify + decode a signed payload, or null if tampered/malformed. */
export const verifyPayload = <T = Record<string, unknown>>(
  token: string | undefined | null
): T | null => {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null
  }
  const [body, sig] = token.split(".")
  if (!body || !sig) {
    return null
  }
  const expected = hmac(body)
  // constant-time compare
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }
  try {
    return JSON.parse(unb64url(body).toString("utf8")) as T
  } catch {
    return null
  }
}

/** Sign an unsubscribe link payload. */
export const signUnsubscribe = (contactId: string, email: string): string =>
  signPayload({ c: contactId, e: email, k: "unsub" })

/** Verify an unsubscribe token → { contactId, email } or null. */
export const verifyUnsubscribe = (
  token: string | undefined | null
): { contactId: string; email: string } | null => {
  const p = verifyPayload<{ c: string; e: string; k: string }>(token)
  if (!p || p.k !== "unsub" || !p.e) {
    return null
  }
  return { contactId: p.c, email: p.e }
}

/** Sign a click-through destination URL (prevents open-redirect abuse). */
export const signClickUrl = (url: string, sendToken: string): string =>
  signPayload({ u: url, s: sendToken, k: "click" })

/** Verify a click token → { url, sendToken } or null. */
export const verifyClickUrl = (
  token: string | undefined | null
): { url: string; sendToken: string } | null => {
  const p = verifyPayload<{ u: string; s: string; k: string }>(token)
  if (!p || p.k !== "click" || !p.u) {
    return null
  }
  return { url: p.u, sendToken: p.s }
}
