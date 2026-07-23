import crypto from "crypto"
import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * Vonage webhook helpers — JWT verification + status mapping.
 *
 * Vonage signs Voice API webhooks with an RS256 JWT in `Authorization: Bearer`,
 * verifiable against the Voice APPLICATION's public key (`VONAGE_PUBLIC_KEY`,
 * PEM). For POST bodies the JWT's `payload_hash` claim is the sha256 hex of the
 * raw body. Gated like Twilio: key unset → skip (dev) with a warning — the
 * coarse `/telephony` secret gate still applies.
 */

const b64urlToBuf = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

export function validateVonageJwt(req: MedusaRequest): boolean {
  const publicKey = process.env.VONAGE_PUBLIC_KEY
  if (!publicKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "[telephony] VONAGE_PUBLIC_KEY is unset — skipping Vonage signature verification (dev mode)."
    )
    return true
  }

  const auth = req.headers["authorization"]
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return false
  const token = auth.slice(7).trim()
  const parts = token.split(".")
  if (parts.length !== 3) return false

  try {
    const header = JSON.parse(b64urlToBuf(parts[0]).toString("utf8"))
    if (header.alg !== "RS256") return false

    const verified = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"),
      publicKey,
      b64urlToBuf(parts[2])
    )
    if (!verified) return false

    const payload = JSON.parse(b64urlToBuf(parts[1]).toString("utf8"))
    const now = Math.floor(Date.now() / 1000)
    const skew = 300
    if (typeof payload.exp === "number" && payload.exp < now - skew) return false
    if (typeof payload.iat === "number" && payload.iat > now + skew) return false

    // POST bodies carry payload_hash = sha256(raw body) hex.
    if (payload.payload_hash) {
      const raw =
        (req as any).rawBody ??
        (typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {}))
      const digest = crypto
        .createHash("sha256")
        .update(typeof raw === "string" ? Buffer.from(raw, "utf8") : raw)
        .digest("hex")
      if (digest !== payload.payload_hash) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Map a Vonage call status to our `call_center_call.status` enum.
 * Vonage: started | ringing | answered | completed | busy | rejected |
 *         timeout | failed | cancelled | unanswered.
 */
export function mapVonageStatus(status?: string): string | null {
  switch ((status ?? "").toLowerCase()) {
    case "started":
    case "ringing":
      return "dialing"
    case "answered":
      return "in_progress"
    case "completed":
      return "completed"
    case "busy":
    case "rejected":
    case "timeout":
    case "unanswered":
      return "no_answer"
    case "failed":
      return "failed"
    case "cancelled":
    case "canceled":
      return "canceled"
    default:
      return null
  }
}
