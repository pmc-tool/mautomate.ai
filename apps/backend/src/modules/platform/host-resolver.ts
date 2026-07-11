import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "./index"

/**
 * HostResolver — the control-plane's authoritative Host -> tenant lookup.
 *
 * This is the ONLY place Host resolution happens (plus the storefront edge,
 * which calls the same control-plane data). A backend instance never resolves
 * tenant by Host — its tenant is a boot constant (see lib/tenant-context). The
 * router + storefront use this to map an incoming hostname to:
 *   { tenant_id, backend_url, publishable_key }
 *
 * Results are cached briefly (host -> tenant is stable) and keyed by the exact
 * normalized host, so a poisoned/mismatched entry can never serve another
 * tenant's store. `verified`/`ssl_status` are surfaced so the edge can refuse
 * to route a half-provisioned custom domain.
 */
export type ResolvedTenant = {
  tenant_id: string
  domain: string
  type: "free" | "custom"
  backend_url: string | null
  publishable_key: string | null
  status: string
  ssl_status: string
  verified: boolean
}

const CACHE_TTL_MS = 30_000

export class HostResolver {
  private readonly container_: MedusaContainer
  private readonly cache_ = new Map<
    string,
    { at: number; value: ResolvedTenant | null }
  >()

  constructor(container: MedusaContainer) {
    this.container_ = container
  }

  private svc(): any {
    return this.container_.resolve(PLATFORM_MODULE)
  }

  static normalizeHost(host: string): string {
    return host
      .trim()
      .toLowerCase()
      .replace(/\.$/, "") // strip trailing dot (FQDN root) first
      .replace(/:\d+$/, "") // then strip port
  }

  /** Drop a cache entry (call after a domain's status changes). */
  invalidate(host: string): void {
    this.cache_.delete(HostResolver.normalizeHost(host))
  }

  /**
   * Resolve a Host header to its tenant, or null when the host is unknown.
   * `nowMs` is injectable for deterministic tests (no Date.now in call sites).
   */
  async resolve(
    host: string,
    nowMs: number = Date.now()
  ): Promise<ResolvedTenant | null> {
    const key = HostResolver.normalizeHost(host)
    const hit = this.cache_.get(key)
    if (hit && nowMs - hit.at < CACHE_TTL_MS) {
      return hit.value
    }

    const svc = this.svc()
    const domains = await svc.listTenantDomains({ domain: key }, { take: 1 })
    const domain = domains?.[0]
    if (!domain) {
      this.cache_.set(key, { at: nowMs, value: null })
      return null
    }

    const tenants = await svc.listTenants({ id: domain.tenant_id }, { take: 1 })
    const tenant = tenants?.[0]
    if (!tenant) {
      this.cache_.set(key, { at: nowMs, value: null })
      return null
    }

    const value: ResolvedTenant = {
      tenant_id: tenant.id,
      domain: domain.domain,
      type: domain.type,
      backend_url: tenant.backend_url ?? null,
      publishable_key: tenant.publishable_key ?? null,
      status: tenant.status,
      ssl_status: domain.ssl_status,
      verified:
        domain.verification_status === "verified" &&
        domain.ssl_status === "active",
    }
    this.cache_.set(key, { at: nowMs, value })
    return value
  }

  /**
   * Edge guard: a host is routable only when it maps to a live tenant whose
   * domain is verified with active SSL (or a free subdomain). Prevents serving
   * a half-provisioned custom domain.
   */
  async routable(host: string, nowMs: number = Date.now()): Promise<ResolvedTenant | null> {
    const r = await this.resolve(host, nowMs)
    if (!r) return null
    if (r.status !== "live") return null
    if (r.type === "custom" && !r.verified) return null
    return r
  }
}

export default HostResolver
