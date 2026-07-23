/**
 * Number-provider abstraction — search / buy / configure / release DIDs at a
 * telephony carrier. Modeled on the CallDone reference (raw HTTP, no SDKs,
 * no-throw results) and adapted to mAutomate:
 *
 *   - providers are PLATFORM-level (env creds), not per-tenant;
 *   - pricing is surfaced in CREDITS (flat `phone_number_month` from the price
 *     book — the same monthly rate the rent cron already bills);
 *   - inbound webhooks carry the shared telephony secret as a `?ts=` query
 *     param because carriers cannot send custom headers.
 *
 * Every method returns `{ ok, data?, error? }` and never throws; credentials
 * are never included in an error message.
 */

export type ProviderResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
}

export type NumberType = "local" | "tollfree" | "mobile"

export type NumberSearchQuery = {
  /** ISO 3166-1 alpha-2, e.g. "US", "AU", "GB". */
  country: string
  type: NumberType
  /** Digit/pattern filter (Twilio Contains / Vonage search pattern). */
  contains?: string
  limit?: number
}

export type AvailableNumber = {
  e164: string
  friendly: string
  locality: string | null
  region: string | null
  country: string
  capabilities: { voice: boolean; sms: boolean }
}

export type PurchasedNumber = {
  /** Carrier-side id (Twilio IncomingPhoneNumber SID / Vonage msisdn). */
  provider_number_id: string
  e164: string
}

export interface NumberProvider {
  readonly name: "twilio" | "vonage"
  isConfigured(): boolean
  search(q: NumberSearchQuery): Promise<ProviderResult<AvailableNumber[]>>
  /** Buy the DID. `country` is required by Vonage; Twilio ignores it. */
  purchase(e164: string, country: string): Promise<ProviderResult<PurchasedNumber>>
  /**
   * Point the carrier's inbound voice/status webhooks at us (Twilio) or link
   * the number to the platform Voice Application (Vonage). Non-fatal by
   * contract: the number is already owned when this runs.
   */
  configureInbound(
    providerNumberId: string,
    e164: string,
    country: string
  ): Promise<ProviderResult<void>>
  /** Release the DID at the carrier (idempotent: gone-already is success). */
  release(
    providerNumberId: string,
    e164: string,
    country: string
  ): Promise<ProviderResult<void>>
}

/** Public base URL carriers call back on (goes through the tunnel to :9500). */
export const webhookBaseUrl = (): string =>
  (
    process.env.TWILIO_WEBHOOK_BASE_URL ??
    process.env.PUBLIC_API_BASE_URL ??
    "https://api.mautomate.ai"
  ).replace(/\/$/, "")

/**
 * The shared telephony secret as a query param — carriers can't send custom
 * headers, so webhook URLs embed it and the /telephony middleware accepts
 * `?ts=` alongside the `x-telephony-secret` header.
 */
export const webhookSecretQuery = (): string => {
  const secret = process.env.TELEPHONY_WEBHOOK_SECRET ?? ""
  return secret ? `?ts=${encodeURIComponent(secret)}` : ""
}
