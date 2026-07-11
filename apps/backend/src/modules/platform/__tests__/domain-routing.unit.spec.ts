import { DomainRoutingService, isApexDomain } from "../domain-routing"
import { CloudflareSaaSClient } from "../provider/cloudflare/client"

describe("isApexDomain", () => {
  it("detects registrable apex vs subdomain", () => {
    expect(isApexDomain("acme.com")).toBe(true)
    expect(isApexDomain("shop.acme.com")).toBe(false)
    expect(isApexDomain("acme.co.uk")).toBe(true) // two-part suffix
    expect(isApexDomain("shop.acme.co.uk")).toBe(false)
    expect(isApexDomain("mautomate.ai.")).toBe(true) // trailing dot tolerated
  })
})

describe("CloudflareSaaSClient — not configured", () => {
  it("reports not-configured and no-throws", async () => {
    const c = new CloudflareSaaSClient()
    // env not set in unit test → not configured
    expect(c.isConfigured()).toBe(false)
    const r = await c.createCustomHostname("acme.com")
    expect(r.ok).toBe(false)
    expect(r.error).toBe("cloudflare_not_configured")
  })
})

function fakeContainer() {
  const rows: any[] = []
  const svc = {
    rows,
    async createTenantDomains(input: any[]) {
      const created = input.map((d, i) => ({ id: `tdom_${rows.length + i}`, ...d }))
      rows.push(...created)
      return created
    },
    async retrieveTenantDomain(id: string) {
      return rows.find((r) => r.id === id)
    },
    async updateTenantDomains(patch: any) {
      const r = rows.find((x) => x.id === patch.id)
      Object.assign(r, patch)
      return r
    },
    async deleteTenantDomains() {},
  }
  return { container: { resolve: () => svc } as any, svc }
}

function fakeCF(configured: boolean): any {
  return {
    isConfigured: () => configured,
    fallbackOrigin: () => "origin.mautomate.ai",
    async createCustomHostname(hostname: string) {
      return {
        ok: true,
        data: {
          id: "cf_123",
          hostname,
          ssl_status: "pending",
          verification_status: "pending",
          ownership_records: [{ type: "txt", name: "_cf.acme.com", value: "abc" }],
          ssl_records: [],
        },
      }
    },
    async getCustomHostname() {
      return {
        ok: true,
        data: {
          id: "cf_123",
          hostname: "acme.com",
          ssl_status: "active",
          verification_status: "verified",
          ownership_records: [],
          ssl_records: [],
        },
      }
    },
    async deleteCustomHostname() {
      return { ok: true }
    },
  }
}

describe("DomainRoutingService", () => {
  it("subdomain instructions are a single CNAME to origin", () => {
    const { container } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(false))
    const ins = s.instructionsFor("shop.acme.com")
    expect(ins[0]).toEqual({
      kind: "cname",
      name: "shop.acme.com",
      value: "origin.mautomate.ai",
    })
  })

  it("apex instructions warn about CNAME-flattening + Delegated DCV", () => {
    const { container } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(false))
    const ins = s.instructionsFor("acme.com")
    expect(ins[0].kind).toBe("note")
    expect(ins[0].value).toMatch(/Delegated DCV/)
  })

  it("connectCustomDomain creates a CF hostname + pending row + DCV records", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(true))
    const res = await s.connectCustomDomain("ten_a", "ACME.com.")
    expect(res.ok).toBe(true)
    expect(svc.rows[0].domain).toBe("acme.com") // normalized
    expect(svc.rows[0].cf_hostname_id).toBe("cf_123")
    expect(svc.rows[0].verification_status).toBe("pending")
    expect(res.instructions.some((i) => i.kind === "txt")).toBe(true)
  })

  it("connectCustomDomain still records a pending row when CF is off", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(false))
    const res = await s.connectCustomDomain("ten_a", "acme.com")
    expect(res.ok).toBe(true)
    expect(svc.rows[0].cf_hostname_id).toBeNull()
  })

  it("syncCustomHostname promotes to verified when CF reports active", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(true))
    await s.connectCustomDomain("ten_a", "acme.com")
    const out = await s.syncCustomHostname(svc.rows[0].id)
    expect(out).toEqual({ ssl_status: "active", verification_status: "verified" })
  })
})
