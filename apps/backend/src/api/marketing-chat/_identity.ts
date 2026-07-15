import crypto from "crypto"

/**
 * Signed-in identity for the public chat widget.
 *
 * THE THREAT: /marketing-chat/* is an ANONYMOUS, public endpoint. If the widget
 * could simply POST `{ customer_id: "cus_123" }` and be believed, anyone could
 * type another person's customer id and read their orders, addresses and email.
 * A claim from the browser is worthless.
 *
 * SO: the STOREFRONT SERVER — which already holds the shopper's httpOnly auth
 * cookie and has verified them against Medusa — mints a short-lived token bound
 * to the customer id and signs it with a secret only the two servers share. The
 * browser carries the token but cannot forge, alter or extend it, and cannot
 * mint one for a customer it is not logged in as.
 *
 * Format: base64url(payload).base64url(hmac-sha256(payload))
 * Payload: { cid, exp } — nothing else is trusted, ever.
 */

const SECRET = (): string | null => process.env.CHAT_IDENTITY_SECRET || null

export type ChatIdentity = { customerId: string }

const sign = (payload: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url")

/** Mint a token (used by tests and by the storefront's own mirror of this file). */
export const mintIdentity = (
  customerId: string,
  ttlSeconds = 3600
): string | null => {
  const secret = SECRET()
  if (!secret || !customerId) {
    return null
  }
  const payload = Buffer.from(
    JSON.stringify({ cid: customerId, exp: Date.now() + ttlSeconds * 1000 })
  ).toString("base64url")
  return `${payload}.${sign(payload, secret)}`
}

/**
 * Verify a token and return the customer it proves. Returns null on ANY doubt —
 * no secret configured, malformed, bad signature, or expired. Fail closed: an
 * unverifiable identity is simply an anonymous visitor, never a trusted one.
 */
export const verifyIdentity = (token: unknown): ChatIdentity | null => {
  const secret = SECRET()
  if (!secret || typeof token !== "string" || !token.includes(".")) {
    return null
  }

  const [payload, signature] = token.split(".")
  if (!payload || !signature) {
    return null
  }

  const expected = sign(payload, secret)
  // Constant-time compare: a fast-fail string compare leaks the signature one
  // byte at a time to anyone willing to measure.
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString())
    const cid = typeof decoded?.cid === "string" ? decoded.cid : null
    const exp = Number(decoded?.exp)
    if (!cid || !Number.isFinite(exp) || Date.now() > exp) {
      return null
    }
    return { customerId: cid }
  } catch {
    return null
  }
}
