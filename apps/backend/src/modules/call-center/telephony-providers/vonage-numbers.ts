import {
  AvailableNumber,
  NumberProvider,
  NumberSearchQuery,
  ProviderResult,
  PurchasedNumber,
} from "./types"

/**
 * Vonage (Nexmo) number provider — raw REST, form-encoded api_key/api_secret.
 *
 * Improves on the CallDone reference, which never implemented Vonage search or
 * application linking (numbers had to be linked manually in the dashboard):
 *
 *   search    GET  /number/search?country=&type=&features=VOICE&pattern=
 *   purchase  POST /number/buy      {country, msisdn}
 *   configure POST /number/update   {app_id: VONAGE_APPLICATION_ID, ...} —
 *             links the DID to the platform Voice Application whose answer_url
 *             / event_url point at /telephony/vonage/answer|events. The URLs
 *             live on the APPLICATION (set once), not per number.
 *   release   POST /number/cancel   {country, msisdn}
 *
 * GOTCHA (from CallDone): Vonage returns HTTP 200 even on logical failure —
 * only `error-code === "200"` is success.
 */

const API = "https://rest.nexmo.com"

const TYPE_MAP: Record<string, string> = {
  local: "landline",
  tollfree: "landline-toll-free",
  mobile: "mobile-lvn",
}

export class VonageNumberProvider implements NumberProvider {
  readonly name = "vonage" as const

  private key(): string {
    return process.env.VONAGE_API_KEY ?? ""
  }
  private secret(): string {
    return process.env.VONAGE_API_SECRET ?? ""
  }
  private appId(): string {
    return process.env.VONAGE_APPLICATION_ID ?? ""
  }

  isConfigured(): boolean {
    return !!this.key() && !!this.secret()
  }

  private creds(): Record<string, string> {
    return { api_key: this.key(), api_secret: this.secret() }
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    params: Record<string, string>
  ): Promise<ProviderResult<T>> {
    if (!this.isConfigured()) {
      return { ok: false, error: "vonage_not_configured" }
    }
    try {
      const qs = new URLSearchParams({ ...this.creds(), ...params }).toString()
      const url = method === "GET" ? `${API}${path}?${qs}` : `${API}${path}`
      const res = await fetch(url, {
        method,
        headers:
          method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : undefined,
        body: method === "POST" ? qs : undefined,
        signal: AbortSignal.timeout(15_000),
      })
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          ok: false,
          error:
            json?.["error-code-label"] ||
            json?.error_title ||
            `vonage_http_${res.status}`,
        }
      }
      return { ok: true, data: json as T }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "vonage_request_failed" }
    }
  }

  /** Vonage's write endpoints signal success via `error-code === "200"`. */
  private static writeOk(json: any): { ok: boolean; error?: string } {
    const code = String(json?.["error-code"] ?? "")
    if (code === "200" || code === "") return { ok: true }
    // 401 on /number/cancel for an already-released number reads as "not found"
    return {
      ok: false,
      error: json?.["error-code-label"] || `vonage_error_${code}`,
    }
  }

  async search(q: NumberSearchQuery): Promise<ProviderResult<AvailableNumber[]>> {
    const country = (q.country || "US").toUpperCase()
    const params: Record<string, string> = {
      country,
      features: "VOICE",
      type: TYPE_MAP[q.type] ?? "landline",
      size: String(Math.min(Math.max(q.limit ?? 20, 1), 30)),
    }
    if (q.contains) {
      params.pattern = q.contains
      params.search_pattern = "1" // contains
    }
    const r = await this.call<any>("GET", "/number/search", params)
    if (!r.ok) return r as ProviderResult<AvailableNumber[]>
    const rows = Array.isArray(r.data?.numbers) ? r.data.numbers : []
    return {
      ok: true,
      data: rows.map((n: any) => ({
        e164: `+${n.msisdn}`,
        friendly: `+${n.msisdn}`,
        locality: null,
        region: null,
        country: n.country ?? country,
        capabilities: {
          voice: (n.features ?? []).includes("VOICE"),
          sms: (n.features ?? []).includes("SMS"),
        },
      })),
    }
  }

  async purchase(
    e164: string,
    country: string
  ): Promise<ProviderResult<PurchasedNumber>> {
    const msisdn = e164.replace(/^\+/, "")
    const r = await this.call<any>("POST", "/number/buy", {
      country: country.toUpperCase(),
      msisdn,
    })
    if (!r.ok) return r as ProviderResult<PurchasedNumber>
    const w = VonageNumberProvider.writeOk(r.data)
    if (!w.ok) return { ok: false, error: w.error }
    return { ok: true, data: { provider_number_id: msisdn, e164 } }
  }

  async configureInbound(
    providerNumberId: string,
    _e164: string,
    country: string
  ): Promise<ProviderResult<void>> {
    const appId = this.appId()
    if (!appId) {
      // Number is owned but unlinked — inbound won't route until the DID is
      // linked to a Voice Application (VONAGE_APPLICATION_ID) here or manually.
      return { ok: false, error: "vonage_application_not_configured" }
    }
    const r = await this.call<any>("POST", "/number/update", {
      country: country.toUpperCase(),
      msisdn: providerNumberId,
      app_id: appId,
      voiceCallbackType: "app",
      voiceCallbackValue: appId,
    })
    if (!r.ok) return r as ProviderResult<void>
    const w = VonageNumberProvider.writeOk(r.data)
    return w.ok ? { ok: true } : { ok: false, error: w.error }
  }

  async release(
    providerNumberId: string,
    _e164: string,
    country: string
  ): Promise<ProviderResult<void>> {
    const r = await this.call<any>("POST", "/number/cancel", {
      country: country.toUpperCase(),
      msisdn: providerNumberId,
    })
    if (!r.ok) {
      // Treat "not found"-shaped failures as already-released (idempotent).
      if (/not found|404/i.test(r.error ?? "")) return { ok: true }
      return r as ProviderResult<void>
    }
    const w = VonageNumberProvider.writeOk(r.data)
    return w.ok ? { ok: true } : { ok: false, error: w.error }
  }
}

export default VonageNumberProvider
