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

/**
 * A per-customer-domain zone in our account — the "just change your
 * nameservers" flow. `name_servers` is the pair the customer sets at their
 * registrar; `status` flips pending → active once delegation propagates.
 */
export type CFZone = {
  id: string
  name: string
  status: string // pending | active | ...
  name_servers: string[]
}

export type CFDnsRecord = {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean
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

  // ---------------------------------------------------------------------
  // Zone-per-customer-domain (the nameserver-change flow, apex domains)
  // ---------------------------------------------------------------------

  /** true when the token/account can create zones (the NS flow is available). */
  zoneFlowAvailable(): boolean {
    return !!this.cfg?.accountId
  }

  /** The cfargotunnel.com hostname customer-zone records point at. */
  tunnelTarget(): string | null {
    return this.cfg?.tunnelTarget ?? null
  }

  private mapZone(z: any): CFZone {
    return {
      id: z.id,
      name: z.name,
      status: z.status ?? "pending",
      name_servers: Array.isArray(z.name_servers) ? z.name_servers : [],
    }
  }

  /** Find a zone in our account by exact name (already-added domains). */
  async findZoneByName(name: string): Promise<CFResult<CFZone | null>> {
    const r = await this.call<any[]>(
      "GET",
      `/zones?name=${encodeURIComponent(name)}&account.id=${this.cfg?.accountId}`
    )
    if (!r.ok) return r as CFResult<CFZone | null>
    const z = (r.data ?? [])[0]
    return { ok: true, data: z ? this.mapZone(z) : null }
  }

  /**
   * Create a full zone for a customer domain; idempotent — if the zone already
   * exists in our account it is fetched and returned instead.
   */
  async createZone(domain: string): Promise<CFResult<CFZone>> {
    if (!this.cfg?.accountId) {
      return { ok: false, error: "cloudflare_account_not_configured" }
    }
    const r = await this.call<any>("POST", `/zones`, {
      name: domain,
      account: { id: this.cfg.accountId },
      type: "full",
    })
    if (r.ok) return { ok: true, data: this.mapZone(r.data) }
    // 1061: zone already exists on this account — reuse it.
    if (/already exists/i.test(r.error ?? "")) {
      const existing = await this.findZoneByName(domain)
      if (existing.ok && existing.data) return { ok: true, data: existing.data }
    }
    return r as CFResult<CFZone>
  }

  /** Poll a customer zone (status flips to "active" once NS delegation lands). */
  async getZone(zoneId: string): Promise<CFResult<CFZone>> {
    const r = await this.call<any>("GET", `/zones/${zoneId}`)
    return r.ok ? { ok: true, data: this.mapZone(r.data) } : (r as CFResult<CFZone>)
  }

  /** Delete a customer zone (disconnect / compensation). */
  async deleteZone(zoneId: string): Promise<CFResult<void>> {
    return this.call<void>("DELETE", `/zones/${zoneId}`)
  }

  /**
   * Ask Cloudflare to scan + import the domain's existing public records
   * (MX, TXT, existing A…) so the customer's email keeps working after the
   * nameserver change. Best-effort.
   */
  async scanZoneRecords(zoneId: string): Promise<CFResult<void>> {
    return this.call<void>("POST", `/zones/${zoneId}/dns_records/scan`)
  }

  async listDnsRecords(zoneId: string): Promise<CFResult<CFDnsRecord[]>> {
    const r = await this.call<any[]>(
      "GET",
      `/zones/${zoneId}/dns_records?per_page=200`
    )
    if (!r.ok) return r as CFResult<CFDnsRecord[]>
    return {
      ok: true,
      data: (r.data ?? []).map((x: any) => ({
        id: x.id,
        type: x.type,
        name: x.name,
        content: x.content,
        proxied: !!x.proxied,
      })),
    }
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<CFResult<void>> {
    return this.call<void>("DELETE", `/zones/${zoneId}/dns_records/${recordId}`)
  }

  /** Create a DNS record in a customer zone (routing CNAMEs to the tunnel). */
  async createDnsRecord(
    zoneId: string,
    record: { type: string; name: string; content: string; proxied?: boolean }
  ): Promise<CFResult<CFDnsRecord>> {
    const r = await this.call<any>("POST", `/zones/${zoneId}/dns_records`, {
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied ?? true,
      ttl: 1,
    })
    if (!r.ok) return r as CFResult<CFDnsRecord>
    return {
      ok: true,
      data: {
        id: r.data.id,
        type: r.data.type,
        name: r.data.name,
        content: r.data.content,
        proxied: !!r.data.proxied,
      },
    }
  }

  // ---------------------------------------------------------------------
  // Custom hostnames (SSL for SaaS — the single-CNAME flow, subdomains)
  // ---------------------------------------------------------------------

  /** Register a custom hostname; returns DCV/ownership records for the customer. */
  async createCustomHostname(
    hostname: string,
    sslMethod: "http" | "txt" = "http"
  ): Promise<CFResult<CustomHostname>> {
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
          // "http" validates automatically once the customer's CNAME points at
          // us — the customer never touches TXT records. "txt" remains for
          // pre-provisioning before DNS changes.
          method: sslMethod,
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
