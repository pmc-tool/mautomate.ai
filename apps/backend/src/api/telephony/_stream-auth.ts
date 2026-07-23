import crypto from "crypto"

/**
 * Media-stream auth token — an HMAC of the provider call id, keyed with the
 * shared telephony secret. The voice webhook stamps it into the stream
 * URL/parameters it hands the carrier; the voice-agent recomputes and compares
 * before accepting a websocket. Carriers can't set headers on media
 * websockets, so this is what stops a stranger who knows the public WS host
 * from opening sessions with forged tenant/playbook parameters.
 */
export function streamAuthToken(callId: string): string {
  const secret = process.env.TELEPHONY_WEBHOOK_SECRET ?? ""
  if (!secret || !callId) return ""
  return crypto
    .createHmac("sha256", secret)
    .update(callId)
    .digest("hex")
    .slice(0, 32)
}
