import { HostResolver } from "../host-resolver"

/**
 * HostResolver isolation + routing tests. A fake platform service stands in for
 * the module CRUD; the point is that a host maps to exactly its own tenant, the
 * cache is per-host, and half-provisioned custom domains are not routable.
 */
function fakeContainer(data: {
  domains: any[]
  tenants: any[]
}) {
  const svc = {
    calls: 0,
    async listTenantDomains(filter: any) {
      svc.calls++
      return data.domains.filter((d) => d.domain === filter.domain)
    },
    async listTenants(filter: any) {
      return data.tenants.filter((t) => t.id === filter.id)
    },
  }
  return {
    svc,
    container: { resolve: () => svc } as any,
  }
}

describe("HostResolver", () => {
  const domains = [
    {
      domain: "acme.com",
      tenant_id: "ten_a",
      type: "custom",
      ssl_status: "active",
      verification_status: "verified",
    },
    {
      domain: "shop-b.mautomate.ai",
      tenant_id: "ten_b",
      type: "free",
      ssl_status: "active",
      verification_status: "verified",
    },
    {
      domain: "pending.com",
      tenant_id: "ten_c",
      type: "custom",
      ssl_status: "pending",
      verification_status: "pending",
    },
  ]
  const tenants = [
    { id: "ten_a", status: "live", backend_url: "http://a", publishable_key: "pk_a" },
    { id: "ten_b", status: "live", backend_url: "http://b", publishable_key: "pk_b" },
    { id: "ten_c", status: "provisioning", backend_url: null, publishable_key: null },
  ]

  it("resolves each host to its own tenant + publishable key", async () => {
    const { container } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    expect((await r.resolve("acme.com"))?.tenant_id).toBe("ten_a")
    expect((await r.resolve("acme.com"))?.publishable_key).toBe("pk_a")
    expect((await r.resolve("shop-b.mautomate.ai"))?.tenant_id).toBe("ten_b")
  })

  it("normalizes host (case, port, trailing dot)", async () => {
    const { container } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    expect((await r.resolve("ACME.com:443."))?.tenant_id).toBe("ten_a")
  })

  it("returns null for an unknown host (and never another tenant)", async () => {
    const { container } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    expect(await r.resolve("evil.example")).toBeNull()
  })

  it("caches per host and invalidates precisely", async () => {
    const { container, svc } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    await r.resolve("acme.com", 1000)
    await r.resolve("acme.com", 1000)
    expect(svc.calls).toBe(1) // second read served from cache
    r.invalidate("acme.com")
    await r.resolve("acme.com", 1000)
    expect(svc.calls).toBe(2)
  })

  it("expires the cache after the TTL", async () => {
    const { container, svc } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    await r.resolve("acme.com", 1000)
    await r.resolve("acme.com", 1000 + 40_000) // past 30s TTL
    expect(svc.calls).toBe(2)
  })

  it("routable() refuses a half-provisioned custom domain", async () => {
    const { container } = fakeContainer({ domains, tenants })
    const r = new HostResolver(container)
    expect(await r.routable("pending.com")).toBeNull() // provisioning + unverified
    expect((await r.routable("acme.com"))?.tenant_id).toBe("ten_a")
  })
})
