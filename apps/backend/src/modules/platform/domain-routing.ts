import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "./index"
import { CloudflareSaaSClient } from "./provider/cloudflare/client"

/**
 * DomainRoutingService — the custom-domain lifecycle. It records Cloudflare
 * state onto tenant_domain rows and gives onboarding the exact instructions to
 * show a customer.
 *
 * TWO connect modes, chosen automatically:
 *
 *   1. APEX domain (yourbrand.com) → "nameserver" mode. We create a zone for
 *      the domain in our Cloudflare account, import the domain's existing DNS
 *      records (email keeps working), point apex + wildcard at the platform
 *      tunnel ourselves, and the customer's ONLY step is changing their
 *      registrar nameservers to the two we show. HTTPS is automatic.
 *
 *   2. SUBDOMAIN (shop.yourbrand.com) → "cname" mode via Cloudflare for SaaS.
 *      A single CNAME to the fallback origin; cert issuance validates over
 *      HTTP once the CNAME resolves — no TXT records.
 *
 * The old flow (TXT DCV + apex ALIAS/flattening notes) required DNS-record
 * surgery most customers cannot do; it never converted. Mode "ns" replaces it.
 */
export type DnsInstruction = {
  kind: "cname" | "txt" | "note" | "ns"
  name: string
  value: string
}

/** true when `domain` is a registrable apex (e.g. acme.com), not a subdomain. */
export const isApexDomain = (domain: string): boolean => {
  const host = domain.trim().toLowerCase().replace(/\.$/, "")
  const labels = host.split(".")
  // naive but effective for common TLDs + well-known two-part suffixes
  const twoPart = new Set(["co.uk", "com.bd", "com.au", "co.in", "com.br"])
  const suffix2 = labels.slice(-2).join(".")
  if (twoPart.has(suffix2)) return labels.length === 3
  return labels.length === 2
}

export class DomainRoutingService {
  private readonly container_: MedusaContainer
  private readonly cf_: CloudflareSaaSClient

  constructor(container: MedusaContainer, client?: CloudflareSaaSClient) {
    this.container_ = container
    this.cf_ = client ?? new CloudflareSaaSClient()
  }

  private svc(): any {
    return this.container_.resolve(PLATFORM_MODULE)
  }

  /** DNS records the customer must set to connect `domain` (legacy/fallback). */
  instructionsFor(domain: string, records: DnsInstruction[] = []): DnsInstruction[] {
    if (records.length) return records
    const origin = this.cf_.fallbackOrigin() ?? "origin.mautomate.ai"
    return [{ kind: "cname", name: domain, value: origin }]
  }

  /**
   * NS mode: create (or reuse) a Cloudflare zone for the apex domain, import
   * its existing records, and point apex + wildcard at the platform tunnel.
   * Returns the nameserver-pair instructions, or an error string.
   */
  private async provisionZone(
    domain: string
  ): Promise<{ ok: boolean; zoneId?: string; nameServers?: string[]; dcv?: DnsInstruction[]; error?: string }> {
    const created = await this.cf_.createZone(domain)
    if (!created.ok || !created.data) {
      return { ok: false, error: created.error }
    }
    const zone = created.data

    // Import the domain's live records FIRST (MX/TXT/etc — keeps the
    // customer's email working after delegation). Best-effort.
    await this.cf_.scanZoneRecords(zone.id)

    // Routing records we own: apex + wildcard → the tunnel, proxied. Remove
    // any imported/stale address records at those names so ours are
    // authoritative (a parked A record at apex would otherwise win/conflict).
    const target = this.cf_.tunnelTarget()
    if (target) {
      const managed = new Set([domain, `www.${domain}`, `*.${domain}`])
      const existing = await this.cf_.listDnsRecords(zone.id)
      for (const rec of existing.data ?? []) {
        if (
          managed.has(rec.name.toLowerCase()) &&
          ["A", "AAAA", "CNAME"].includes(rec.type)
        ) {
          await this.cf_.deleteDnsRecord(zone.id, rec.id)
        }
      }
      const apex = await this.cf_.createDnsRecord(zone.id, {
        type: "CNAME",
        name: domain,
        content: target,
        proxied: true,
      })
      if (!apex.ok) return { ok: false, error: apex.error }
      const wildcard = await this.cf_.createDnsRecord(zone.id, {
        type: "CNAME",
        name: `*.${domain}`,
        content: target,
        proxied: true,
      })
      if (!wildcard.ok) return { ok: false, error: wildcard.error }
    }

    const ns = zone.name_servers
    return {
      ok: true,
      zoneId: zone.id,
      nameServers: ns,
      dcv: ns.map((n, i) => ({
        kind: "ns" as const,
        name: `Nameserver ${i + 1}`,
        value: n,
      })),
    }
  }

  /**
   * Begin connecting a custom domain and return the customer instructions.
   * Apex domains get the nameserver flow; subdomains get a single CNAME via
   * Cloudflare for SaaS. Degrades gracefully (row created as pending) when CF
   * is unset.
   */
  async connectCustomDomain(
    tenantId: string,
    domain: string
  ): Promise<{ ok: boolean; domain_id?: string; instructions: DnsInstruction[]; error?: string }> {
    const svc = this.svc()
    const normalized = domain.trim().toLowerCase().replace(/\.$/, "")

    let cfId: string | null = null
    let sslStatus = "pending"
    let dcv: DnsInstruction[] = []
    let verification: Record<string, unknown> = {}

    const useZoneFlow =
      this.cf_.isConfigured() &&
      this.cf_.zoneFlowAvailable() &&
      isApexDomain(normalized)

    if (useZoneFlow) {
      const z = await this.provisionZone(normalized)
      if (!z.ok) {
        return { ok: false, instructions: [], error: z.error }
      }
      dcv = z.dcv ?? []
      verification = {
        mode: "ns",
        zone_id: z.zoneId,
        name_servers: z.nameServers,
        dcv,
      }
    } else if (this.cf_.isConfigured()) {
      const created = await this.cf_.createCustomHostname(normalized, "http")
      if (!created.ok || !created.data) {
        return { ok: false, instructions: [], error: created.error }
      }
      cfId = created.data.id
      sslStatus = created.data.ssl_status
      const origin = this.cf_.fallbackOrigin() ?? "origin.mautomate.ai"
      // HTTP DCV: the single CNAME is both routing AND validation — the
      // customer never adds TXT records.
      dcv = [{ kind: "cname", name: normalized, value: origin }]
      verification = { mode: "cname", dcv }
    } else {
      verification = { mode: "pending", dcv }
    }

    const [row] = await svc.createTenantDomains([
      {
        tenant_id: tenantId,
        domain: normalized,
        type: "custom",
        cf_hostname_id: cfId,
        ssl_status: sslStatus === "active" ? "active" : "pending",
        verification_status: "pending",
        verification,
      },
    ])

    return {
      ok: true,
      domain_id: row.id,
      instructions: dcv,
    }
  }

  /** Poll CF for a domain and reconcile ssl/verification status onto the row. */
  async syncCustomHostname(
    domainId: string
  ): Promise<{ ssl_status: string; verification_status: string } | null> {
    const svc = this.svc()
    const row = await svc.retrieveTenantDomain(domainId)
    if (!row || !this.cf_.isConfigured()) return null

    // NS mode: the domain is live once its zone activates (nameserver
    // delegation has propagated). Universal SSL issues alongside activation.
    const zoneId = row.verification?.zone_id
    if (zoneId) {
      const z = await this.cf_.getZone(zoneId)
      if (!z.ok || !z.data) return null
      const active = z.data.status === "active"
      const ssl_status = active ? "active" : "pending"
      const verification_status = active ? "verified" : "pending"
      await svc.updateTenantDomains({ id: domainId, ssl_status, verification_status })
      return { ssl_status, verification_status }
    }

    if (!row.cf_hostname_id) return null
    const r = await this.cf_.getCustomHostname(row.cf_hostname_id)
    if (!r.ok || !r.data) return null

    const ssl_status = r.data.ssl_status === "active" ? "active" : "pending"
    const verification_status =
      r.data.verification_status === "verified" && r.data.ssl_status === "active"
        ? "verified"
        : r.data.verification_status
    await svc.updateTenantDomains({ id: domainId, ssl_status, verification_status })
    return { ssl_status, verification_status }
  }

  /** Delete the CF zone / custom hostname and the row (de-provision). */
  async disconnectCustomDomain(domainId: string): Promise<void> {
    const svc = this.svc()
    const row = await svc.retrieveTenantDomain(domainId)
    if (row && this.cf_.isConfigured()) {
      const zoneId = row.verification?.zone_id
      if (zoneId) {
        await this.cf_.deleteZone(zoneId)
      } else if (row.cf_hostname_id) {
        await this.cf_.deleteCustomHostname(row.cf_hostname_id)
      }
    }
    await svc.deleteTenantDomains([domainId])
  }
}

export default DomainRoutingService
