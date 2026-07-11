/**
 * Shared helpers for the Meta-family channels (whatsapp, messenger, instagram).
 * The `_` prefix keeps Medusa's file-based router from treating this as a route.
 * Holds the Meta HMAC-SHA256 webhook verification and a timing-safe hex compare
 * so the three Meta adapters don't duplicate the crypto plumbing.
 */

import crypto from "crypto"

/**
 * Timing-safe comparison of two hex strings. Returns false on any length
 * mismatch or malformed input instead of throwing.
 */
export const timingSafeHexEqual = (a: string, b: string): boolean => {
  if (typeof a !== "string" || typeof b !== "string") {
    return false
  }
  let bufA: Buffer
  let bufB: Buffer
  try {
    bufA = Buffer.from(a, "hex")
    bufB = Buffer.from(b, "hex")
  } catch {
    return false
  }
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

const headerValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null => {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()]
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }
  return typeof raw === "string" ? raw : null
}

/**
 * Verify a Meta webhook: HMAC-SHA256 of the raw body with the app secret,
 * compared timing-safe to the `x-hub-signature-256` header (`sha256=<hex>`).
 * Returns false when the secret is unset, the header is missing/malformed, or
 * the signature does not match.
 */
export const verifyMetaSignature = (
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  appSecret: string | undefined
): boolean => {
  if (!appSecret) {
    return false
  }
  const header = headerValue(headers, "x-hub-signature-256")
  if (!header || !header.startsWith("sha256=")) {
    return false
  }
  const provided = header.slice("sha256=".length)
  if (!provided) {
    return false
  }
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody ?? "", "utf8")
    .digest("hex")
  return timingSafeHexEqual(provided, expected)
}

/**
 * Meta GET verification handshake shared by all three Meta channels. Returns the
 * challenge string to echo when the mode + verify token match, else null.
 */
export const verifyMetaChallenge = (
  query: Record<string, any>,
  verifyToken: string | undefined
): string | null => {
  if (!verifyToken) {
    return null
  }
  if (
    query?.["hub.mode"] === "subscribe" &&
    query?.["hub.verify_token"] === verifyToken
  ) {
    return String(query?.["hub.challenge"] ?? "")
  }
  return null
}
