import { resolveTenantId } from "../../../lib/tenant-context"
import crypto from "crypto"
import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * Twilio webhook helpers — signature validation + call-status mapping.
 *
 * These routes are UNPREFIXED (mounted under `/telephony/*`, NOT `/admin` or
 * `/store`) so they escape both auth stacks — exactly like the CMS
 * secret-gated bridges (`src/api/cms/media/route.ts`,
 * `src/api/cms/visual-publish/route.ts`). The coarse `x-telephony-secret`
 * header gate is applied by `src/api/middlewares.ts`; the finer, per-request
 * Twilio signature check lives IN-HANDLER (see `validateTwilioSignature`).
 *
 * RAW-BODY REQUIREMENT (for the middleware integrator): Twilio signs the raw
 * urlencoded POST body, so `src/api/middlewares.ts` MUST route `/telephony/*`
 * through a urlencoded/raw body parser (`application/x-www-form-urlencoded`)
 * and expose the parsed params on `req.body`. Without that, signature
 * validation below cannot reconstruct Twilio's signed payload. (The middleware
 * agent owns that matcher — this file only documents the dependency.)
 */

/** Constant-time base64 compare (equal-length digests, so no length leak). */
function safeEqualBase64(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ba.length !== bb.length) {
    return false
  }
  return crypto.timingSafeEqual(Uint8Array.from(ba), Uint8Array.from(bb))
}

/**
 * Reconstruct the full URL Twilio signed. Twilio validates against the exact
 * public URL it was configured to POST to, which behind a tunnel/proxy differs
 * from the internal host. Prefer an explicit `TWILIO_WEBHOOK_BASE_URL` override;
 * otherwise build it from the forwarded proto + host + the original path.
 */
export function getFullUrl(req: MedusaRequest): string {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL
  const originalUrl = (req as any).originalUrl ?? req.url ?? ""
  if (base) {
    return `${base.replace(/\/$/, "")}${originalUrl}`
  }
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
    "https"
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers["host"] as string | undefined) ??
    ""
  return `${proto}://${host}${originalUrl}`
}

/**
 * Validate an inbound Twilio webhook per Twilio's documented HMAC-SHA1 scheme:
 *   1. start with the full request URL,
 *   2. append, for each POST param sorted by key, the key immediately followed
 *      by its value (no separators),
 *   3. HMAC-SHA1 that string with the account auth token, base64-encode it,
 *   4. timing-safe compare against the `X-Twilio-Signature` header.
 *
 * Gated: if `TWILIO_AUTH_TOKEN` is unset we SKIP the check (dev) and log a
 * warning — the coarse `x-telephony-secret` middleware gate still applies. We
 * implement this inline rather than depend on the `twilio` SDK being installed.
 */
export function validateTwilioSignature(req: MedusaRequest): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    // eslint-disable-next-line no-console
    console.warn(
      "[telephony] TWILIO_AUTH_TOKEN is unset — skipping Twilio signature verification (dev mode)."
    )
    return true
  }

  const signature = req.headers["x-twilio-signature"]
  if (typeof signature !== "string" || !signature) {
    return false
  }

  const params = (req.body ?? {}) as Record<string, unknown>
  let data = getFullUrl(req)
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    data += key + (value == null ? "" : String(value))
  }

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf8"))
    .digest("base64")

  return safeEqualBase64(expected, signature)
}

/**
 * Map a Twilio `CallStatus` to our `call_center_call.status` enum.
 * Twilio: queued | ringing | in-progress | completed | busy | no-answer |
 *         failed | canceled.
 */
export function mapTwilioStatus(twilioStatus?: string): string | null {
  switch ((twilioStatus ?? "").toLowerCase()) {
    case "queued":
      return "queued"
    case "ringing":
      return "dialing"
    case "in-progress":
      return "in_progress"
    case "completed":
      return "completed"
    case "busy":
      return "no_answer"
    case "no-answer":
      return "no_answer"
    case "failed":
      return "failed"
    case "canceled":
    case "cancelled":
      return "canceled"
    default:
      return null
  }
}

/**
 * Terminal statuses never get overwritten by a later, out-of-order callback
 * (Twilio callbacks can arrive out of order). Used for COALESCE-style idempotent
 * status updates.
 */
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "no_answer",
  "voicemail",
  "canceled",
])

export function isTerminalStatus(status?: string | null): boolean {
  return !!status && TERMINAL_STATUSES.has(status)
}

/** Default tenant for the single-tenant run (call rows still carry tenant_id). */
export function defaultTenantId(): string {
  return resolveTenantId("CALL_CENTER_DEFAULT_TENANT")
}
