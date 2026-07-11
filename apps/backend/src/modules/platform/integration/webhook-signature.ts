import crypto from "crypto"

/**
 * Per-tenant webhook signatures (Phase 5 — replaces the single global
 * TELEPHONY_WEBHOOK_SECRET the review flagged).
 *
 * Each tenant gets a DERIVED secret = HMAC(master, tenant_id), so one leaked or
 * abused tenant secret never exposes the others and secrets rotate with the
 * master. Inbound webhooks are verified against the tenant's derived secret with
 * a constant-time compare.
 */
const masterSecret = (): string => {
  const s = process.env.PLATFORM_WEBHOOK_MASTER_SECRET
  if (!s) throw new Error("PLATFORM_WEBHOOK_MASTER_SECRET not set")
  return s
}

/** Deterministic per-tenant webhook secret derived from the master. */
export const deriveTenantWebhookSecret = (
  tenantId: string,
  master: string = masterSecret()
): string =>
  crypto.createHmac("sha256", master).update(`webhook:${tenantId}`).digest("hex")

/** HMAC-SHA256 signature of a raw body with the tenant's derived secret. */
export const signWebhook = (
  tenantId: string,
  rawBody: string,
  master: string = masterSecret()
): string =>
  crypto
    .createHmac("sha256", deriveTenantWebhookSecret(tenantId, master))
    .update(rawBody)
    .digest("hex")

/** Constant-time verify of an inbound webhook signature for a tenant. */
export const verifyWebhook = (
  tenantId: string,
  rawBody: string,
  signature: string,
  master: string = masterSecret()
): boolean => {
  const expected = signWebhook(tenantId, rawBody, master)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Uint8Array.from(a), Uint8Array.from(b))
}
