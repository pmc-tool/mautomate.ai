import {
  CloudflareConfig,
  getCloudflareConfig,
  isCloudflareConfigured,
} from "./config"

/**
 * CloudflareSaaSClient — a thin, no-throw wrapper over the Cloudflare for SaaS
 * "Custom Hostnames" API (SSL for SaaS). It is the mechanism behind "hundreds
 * of customer domains with valid, auto-renewing TLS":
 *
 *   - createCustomHostname → returns the DCV/ownership records the customer
 *     must set, and starts async cert issuance.
 *   - getCustomHostname → polled until ssl.status === "active".
 *   - deleteCustomHostname → compensation / de-provision.
 *
 * Apex domains: a customer CANNOT CNAME an apex (RFC 1034). For apex we mandate
 * Delegated DCV (cert issuance) plus either www+redirect or CNAME-flattening/
 * ALIAS at the customer's DNS for routing — surfaced via `dcvDelegationRecords`.
 *
 * Every method returns `{ ok, data?, error? }`; the API token is never included
 * in an error message.
 */
export type CFResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
}

export type CustomHostname = {
  id: string
  hostname: string
  ssl_status: string // pending_validation | pending_issuance | active | ...
  verification_status: "pending" | "verified" | "failed"
  ownership_records: Array<{ type: string; name: string; value: string }>
  ssl_records: Array<{ type: string; name: string; value: string }>
}

const API = "https://api.cloudflare.com/client/v4"

export class CloudflareSaaSClient {
  private readonly cfg: CloudflareConfig | null

  constructor() {
    this.cfg = getCloudflareConfig()
  }

  isConfigured(): boolean {
    return isCloudflareConfigured()
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<CFResult<T>> {
    if (!this.cfg) {
      return { ok: false, error: "cloudflare_not_configured" }
    }
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.apiToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        const msg =
          json?.errors?.map((e: any) => e.message).join("; ") ||
          `cloudflare_http_${res.status}`
        return { ok: false, error: msg }
      }
      return { ok: true, data: json.result as T }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "cloudflare_request_failed" }
    }
  }

  private map(result: any): CustomHostname {
    return {
      id: result.id,
      hostname: result.hostname,
      ssl_status: result?.ssl?.status ?? "unknown",
      verification_status:
        result?.status === "active"
          ? "verified"
          : result?.status === "blocked"
          ? "failed"
          : "pending",
      ownership_records: result?.ownership_verification
        ? [
            {
              type: result.ownership_verification.type,
              name: result.ownership_verification.name,
              value: result.ownership_verification.value,
            },
          ]
        : [],
      ssl_records: result?.ssl?.validation_records ?? [],
    }
  }

  /** Total custom hostnames on the zone — the exact metric Cloudflare bills on. */
  async countCustomHostnames(): Promise<number | null> {
    if (!this.cfg) return null
    try {
      const res = await fetch(
        `${API}/zones/${this.cfg.zoneId}/custom_hostnames?per_page=1`,
        {
          headers: {
            Authorization: `Bearer ${this.cfg.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      )
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) return null
      return Number(json?.result_info?.total_count ?? 0)
    } catch {
      return null
    }
  }

  /** Register a custom hostname; returns DCV/ownership records for the customer. */
  async createCustomHostname(hostname: string): Promise<CFResult<CustomHostname>> {
    // Cost guard: never exceed the configured cap, so testing can't push us
    // past Cloudflare's 100-hostname free tier and trigger billing.
    const cap = this.cfg?.maxHostnames ?? 25
    const count = await this.countCustomHostnames()
    if (count !== null && count >= cap) {
      return {
        ok: false,
        error: `custom_domain_capacity_reached (${count}/${cap})`,
      }
    }
    const r = await this.call<any>(
      "POST",
      `/zones/${this.cfg?.zoneId}/custom_hostnames`,
      {
        hostname,
        ssl: {
          method: "txt",
          type: "dv",
          settings: { min_tls_version: "1.2" },
        },
      }
    )
    return r.ok ? { ok: true, data: this.map(r.data) } : (r as CFResult<CustomHostname>)
  }

  /** Poll a custom hostname's cert + ownership status. */
  async getCustomHostname(id: string): Promise<CFResult<CustomHostname>> {
    const r = await this.call<any>(
      "GET",
      `/zones/${this.cfg?.zoneId}/custom_hostnames/${id}`
    )
    return r.ok ? { ok: true, data: this.map(r.data) } : (r as CFResult<CustomHostname>)
  }

  /** Delete a custom hostname (compensation / de-provision). */
  async deleteCustomHostname(id: string): Promise<CFResult<void>> {
    return this.call<void>(
      "DELETE",
      `/zones/${this.cfg?.zoneId}/custom_hostnames/${id}`
    )
  }

  /** The CNAME target a customer points a subdomain (or www) at. */
  fallbackOrigin(): string | null {
    return this.cfg?.fallbackOrigin ?? null
  }
}

export default CloudflareSaaSClient
