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

const afterAllRestore: Array<() => void> = []
afterAll(() => afterAllRestore.forEach((f) => f()))

describe("CloudflareSaaSClient — not configured", () => {
  it("reports not-configured and no-throws", async () => {
    // jest may load the real .env — force the unconfigured state
    const saved = {
      token: process.env.CLOUDFLARE_API_TOKEN,
      zone: process.env.CLOUDFLARE_SAAS_ZONE_ID,
    }
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.CLOUDFLARE_SAAS_ZONE_ID
    afterAllRestore.push(() => {
      if (saved.token) process.env.CLOUDFLARE_API_TOKEN = saved.token
      if (saved.zone) process.env.CLOUDFLARE_SAAS_ZONE_ID = saved.zone
    })
    const c = new CloudflareSaaSClient()
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

function fakeCF(configured: boolean, zoneFlow = true): any {
  return {
    calls: [] as string[],
    isConfigured: () => configured,
    zoneFlowAvailable: () => zoneFlow,
    fallbackOrigin: () => "origin.mautomate.ai",
    tunnelTarget: () => "tunnel-id.cfargotunnel.com",
    async createZone(name: string) {
      return {
        ok: true,
        data: {
          id: "zone_123",
          name,
          status: "pending",
          name_servers: ["alexia.ns.cloudflare.com", "cameron.ns.cloudflare.com"],
        },
      }
    },
    async getZone() {
      return {
        ok: true,
        data: {
          id: "zone_123",
          name: "acme.com",
          status: "active",
          name_servers: ["alexia.ns.cloudflare.com", "cameron.ns.cloudflare.com"],
        },
      }
    },
    async deleteZone() {
      return { ok: true }
    },
    async scanZoneRecords() {
      return { ok: true }
    },
    async listDnsRecords() {
      return {
        ok: true,
        data: [
          // an imported parked A record at apex that must be replaced
          { id: "rec_a", type: "A", name: "acme.com", content: "192.0.2.1", proxied: false },
          { id: "rec_mx", type: "MX", name: "acme.com", content: "mail.acme.com", proxied: false },
        ],
      }
    },
    deleted: [] as string[],
    async deleteDnsRecord(_zone: string, id: string) {
      this.deleted.push(id)
      return { ok: true }
    },
    created: [] as any[],
    async createDnsRecord(_zone: string, rec: any) {
      this.created.push(rec)
      return { ok: true, data: { id: "rec_new", ...rec, proxied: true } }
    },
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
  it("fallback instructions are a single CNAME to origin", () => {
    const { container } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(false))
    const ins = s.instructionsFor("shop.acme.com")
    expect(ins[0]).toEqual({
      kind: "cname",
      name: "shop.acme.com",
      value: "origin.mautomate.ai",
    })
  })

  it("apex connect creates a zone, replaces address records, returns NS instructions", async () => {
    const { container, svc } = fakeContainer()
    const cf = fakeCF(true)
    const s = new DomainRoutingService(container, cf)
    const res = await s.connectCustomDomain("ten_a", "ACME.com.")
    expect(res.ok).toBe(true)
    expect(svc.rows[0].domain).toBe("acme.com") // normalized
    expect(svc.rows[0].cf_hostname_id).toBeNull()
    expect(svc.rows[0].verification.zone_id).toBe("zone_123")
    expect(svc.rows[0].verification_status).toBe("pending")
    // the customer's ONLY instruction is the nameserver pair
    expect(res.instructions.map((i) => i.kind)).toEqual(["ns", "ns"])
    expect(res.instructions[0].value).toBe("alexia.ns.cloudflare.com")
    // the imported A record was replaced; MX was preserved
    expect(cf.deleted).toEqual(["rec_a"])
    // apex + wildcard now point at the tunnel
    expect(cf.created.map((r: any) => r.name)).toEqual(["acme.com", "*.acme.com"])
  })

  it("subdomain connect uses a custom hostname with a single CNAME instruction", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(true))
    const res = await s.connectCustomDomain("ten_a", "shop.acme.com")
    expect(res.ok).toBe(true)
    expect(svc.rows[0].cf_hostname_id).toBe("cf_123")
    expect(res.instructions).toEqual([
      { kind: "cname", name: "shop.acme.com", value: "origin.mautomate.ai" },
    ])
  })

  it("connectCustomDomain still records a pending row when CF is off", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(false))
    const res = await s.connectCustomDomain("ten_a", "acme.com")
    expect(res.ok).toBe(true)
    expect(svc.rows[0].cf_hostname_id).toBeNull()
  })

  it("sync promotes an NS-mode domain to verified once its zone activates", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(true))
    await s.connectCustomDomain("ten_a", "acme.com")
    const out = await s.syncCustomHostname(svc.rows[0].id)
    expect(out).toEqual({ ssl_status: "active", verification_status: "verified" })
  })

  it("sync promotes a CNAME-mode domain when CF reports active", async () => {
    const { container, svc } = fakeContainer()
    const s = new DomainRoutingService(container, fakeCF(true))
    await s.connectCustomDomain("ten_a", "shop.acme.com")
    const out = await s.syncCustomHostname(svc.rows[0].id)
    expect(out).toEqual({ ssl_status: "active", verification_status: "verified" })
  })
})
