import {
  AvailableNumber,
  NumberProvider,
  NumberSearchQuery,
  ProviderResult,
  PurchasedNumber,
  webhookBaseUrl,
  webhookSecretQuery,
} from "./types"

/**
 * Twilio number provider — raw REST (no SDK), HTTP Basic AccountSid:AuthToken.
 *
 * Flow mirrors the CallDone reference:
 *   search    GET  /AvailablePhoneNumbers/{Country}/{Type}.json
 *   purchase  POST /IncomingPhoneNumbers.json           (returns the number SID)
 *   configure POST /IncomingPhoneNumbers/{sid}.json     (VoiceUrl AFTER buy —
 *             Twilio does not take webhook URLs at purchase time)
 *   release   DELETE /IncomingPhoneNumbers/{sid}.json   (404 = already gone = ok)
 */

const API = "https://api.twilio.com/2010-04-01"

const TYPE_PATH: Record<string, string> = {
  local: "Local",
  tollfree: "TollFree",
  mobile: "Mobile",
}

export class TwilioNumberProvider implements NumberProvider {
  readonly name = "twilio" as const

  private sid(): string {
    return process.env.TWILIO_ACCOUNT_SID ?? ""
  }
  private token(): string {
    return process.env.TWILIO_AUTH_TOKEN ?? ""
  }

  isConfigured(): boolean {
    return !!this.sid() && !!this.token()
  }

  private async call<T>(
    method: string,
    path: string,
    form?: Record<string, string>
  ): Promise<ProviderResult<T>> {
    if (!this.isConfigured()) {
      return { ok: false, error: "twilio_not_configured" }
    }
    try {
      const res = await fetch(`${API}/Accounts/${this.sid()}${path}`, {
        method,
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${this.sid()}:${this.token()}`).toString("base64"),
          ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: form ? new URLSearchParams(form).toString() : undefined,
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 404 && method === "DELETE") {
        return { ok: true } // releasing a number that's already gone
      }
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          ok: false,
          error: json?.message || `twilio_http_${res.status}`,
        }
      }
      return { ok: true, data: json as T }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "twilio_request_failed" }
    }
  }

  async search(q: NumberSearchQuery): Promise<ProviderResult<AvailableNumber[]>> {
    const type = TYPE_PATH[q.type] ?? "Local"
    const country = (q.country || "US").toUpperCase()
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 30)
    const params = new URLSearchParams({
      VoiceEnabled: "true",
      PageSize: String(limit),
    })
    if (q.contains) params.set("Contains", q.contains)

    const r = await this.call<any>(
      "GET",
      `/AvailablePhoneNumbers/${country}/${type}.json?${params.toString()}`
    )
    if (!r.ok) return r as ProviderResult<AvailableNumber[]>
    const rows = Array.isArray(r.data?.available_phone_numbers)
      ? r.data.available_phone_numbers
      : []
    return {
      ok: true,
      data: rows.map((n: any) => ({
        e164: n.phone_number,
        friendly: n.friendly_name ?? n.phone_number,
        locality: n.locality ?? null,
        region: n.region ?? null,
        country: n.iso_country ?? country,
        capabilities: {
          voice: !!n?.capabilities?.voice,
          sms: !!(n?.capabilities?.SMS ?? n?.capabilities?.sms),
        },
      })),
    }
  }

  async purchase(e164: string): Promise<ProviderResult<PurchasedNumber>> {
    const r = await this.call<any>("POST", `/IncomingPhoneNumbers.json`, {
      PhoneNumber: e164,
    })
    if (!r.ok) return r as ProviderResult<PurchasedNumber>
    return {
      ok: true,
      data: {
        provider_number_id: r.data?.sid ?? "",
        e164: r.data?.phone_number ?? e164,
      },
    }
  }

  async configureInbound(
    providerNumberId: string
  ): Promise<ProviderResult<void>> {
    const base = webhookBaseUrl()
    const ts = webhookSecretQuery()
    const r = await this.call<any>(
      "POST",
      `/IncomingPhoneNumbers/${providerNumberId}.json`,
      {
        VoiceUrl: `${base}/telephony/twilio/voice${ts}`,
        VoiceMethod: "POST",
        StatusCallback: `${base}/telephony/twilio/status${ts}`,
        StatusCallbackMethod: "POST",
      }
    )
    return r.ok ? { ok: true } : (r as ProviderResult<void>)
  }

  async release(providerNumberId: string): Promise<ProviderResult<void>> {
    const r = await this.call<void>(
      "DELETE",
      `/IncomingPhoneNumbers/${providerNumberId}.json`
    )
    return r.ok ? { ok: true } : r
  }
}

export default TwilioNumberProvider
