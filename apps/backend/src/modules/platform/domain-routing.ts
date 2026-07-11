import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "./index"
import { CloudflareSaaSClient } from "./provider/cloudflare/client"

/**
 * DomainRoutingService — the custom-domain lifecycle on top of the Cloudflare
 * for SaaS client. It records CF hostname state onto tenant_domain rows and
 * gives onboarding the exact DNS instructions to show a customer.
 *
 * Apex handling: an apex (root) domain cannot CNAME, so we branch the customer
 * instructions — for a subdomain (or www) it's a single CNAME to the fallback
 * origin; for an apex it's Delegated DCV for the cert plus CNAME-flattening /
 * ALIAS (or a www + redirect) for routing.
 */
export type DnsInstruction = {
  kind: "cname" | "txt" | "note"
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

  /** DNS records the customer must set to connect `domain`. */
  instructionsFor(domain: string, records: DnsInstruction[] = []): DnsInstruction[] {
    const origin = this.cf_.fallbackOrigin() ?? "origin.mautomate.ai"
    if (isApexDomain(domain)) {
      return [
        {
          kind: "note",
          name: domain,
          value:
            "Apex domain: use CNAME-flattening/ALIAS to the origin (or point www and add an apex→www redirect). Cert issuance uses Delegated DCV.",
        },
        ...records,
      ]
    }
    return [{ kind: "cname", name: domain, value: origin }, ...records]
  }

  /**
   * Begin connecting a custom domain: create the CF custom hostname, persist its
   * id + status onto the tenant_domain row, and return the customer DNS records.
   * Degrades gracefully (still creates the row as pending) when CF is unset.
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

    if (this.cf_.isConfigured()) {
      const created = await this.cf_.createCustomHostname(normalized)
      if (!created.ok || !created.data) {
        return { ok: false, instructions: [], error: created.error }
      }
      cfId = created.data.id
      sslStatus = created.data.ssl_status
      dcv = [
        ...created.data.ownership_records.map((r) => ({
          kind: "txt" as const,
          name: r.name,
          value: r.value,
        })),
        ...created.data.ssl_records.map((r) => ({
          kind: "txt" as const,
          name: r.name,
          value: r.value,
        })),
      ]
    }

    const [row] = await svc.createTenantDomains([
      {
        tenant_id: tenantId,
        domain: normalized,
        type: "custom",
        cf_hostname_id: cfId,
        ssl_status: sslStatus === "active" ? "active" : "pending",
        verification_status: "pending",
        verification: { dcv },
      },
    ])

    return {
      ok: true,
      domain_id: row.id,
      instructions: this.instructionsFor(normalized, dcv),
    }
  }

  /** Poll CF for a domain and reconcile ssl/verification status onto the row. */
  async syncCustomHostname(
    domainId: string
  ): Promise<{ ssl_status: string; verification_status: string } | null> {
    const svc = this.svc()
    const row = await svc.retrieveTenantDomain(domainId)
    if (!row?.cf_hostname_id || !this.cf_.isConfigured()) return null

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

  /** Delete the custom hostname and its row (compensation / de-provision). */
  async disconnectCustomDomain(domainId: string): Promise<void> {
    const svc = this.svc()
    const row = await svc.retrieveTenantDomain(domainId)
    if (row?.cf_hostname_id && this.cf_.isConfigured()) {
      await this.cf_.deleteCustomHostname(row.cf_hostname_id)
    }
    await svc.deleteTenantDomains([domainId])
  }
}

export default DomainRoutingService
