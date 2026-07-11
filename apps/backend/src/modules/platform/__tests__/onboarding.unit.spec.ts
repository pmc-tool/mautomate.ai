import {
  checkSignupQuota,
  validateSlug,
  PER_IP_LIMIT,
} from "../abuse/quota"
import { SuperAdminService } from "../super-admin"

describe("signup quota", () => {
  const now = 1_000_000_000
  it("allows within per-IP and global limits", () => {
    expect(checkSignupQuota([], "1.1.1.1", now).allowed).toBe(true)
  })
  it("blocks a per-IP flood", () => {
    const recent = Array.from({ length: PER_IP_LIMIT }, () => ({
      ip: "1.1.1.1",
      at_ms: now - 1000,
    }))
    const v = checkSignupQuota(recent, "1.1.1.1", now)
    expect(v.allowed).toBe(false)
    if (!v.allowed) expect(v.reason).toBe("per_ip_limit")
  })
  it("ignores signups outside the window", () => {
    const recent = Array.from({ length: PER_IP_LIMIT }, () => ({
      ip: "1.1.1.1",
      at_ms: now - 2 * 60 * 60 * 1000, // 2h ago, window is 1h
    }))
    expect(checkSignupQuota(recent, "1.1.1.1", now).allowed).toBe(true)
  })
  it("blocks a global flood regardless of IP", () => {
    const recent = Array.from({ length: 50 }, (_, i) => ({
      ip: `ip-${i}`,
      at_ms: now - 1000,
    }))
    const v = checkSignupQuota(recent, "new-ip", now)
    expect(v.allowed).toBe(false)
    if (!v.allowed) expect(v.reason).toBe("global_limit")
  })
})

describe("slug validation", () => {
  it("accepts a good slug and normalizes case", () => {
    expect(validateSlug("Acme-Shop")).toEqual({ ok: true, slug: "acme-shop" })
  })
  it("rejects bad formats and reserved names", () => {
    expect(validateSlug("a").ok).toBe(false) // too short
    expect(validateSlug("-bad").ok).toBe(false)
    expect(validateSlug("has space").ok).toBe(false)
    const r = validateSlug("admin")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("reserved")
  })
})

describe("SuperAdminService — audited cross-tenant actions", () => {
  function fake() {
    const audits: any[] = []
    const tenants: any = { ten_a: { id: "ten_a", status: "live", backend_url: "http://a" } }
    const svc = {
      audits,
      async createAuditLogs(rows: any[]) {
        audits.push(...rows)
      },
      async retrieveTenant(id: string) {
        return tenants[id]
      },
      async updateTenants(patch: any) {
        Object.assign(tenants[patch.id], patch)
      },
      async listTenants() {
        return Object.values(tenants)
      },
    }
    return { container: { resolve: () => svc } as any, svc }
  }

  it("suspend writes an audit row and flips status", async () => {
    const { container, svc } = fake()
    const admin = new SuperAdminService(container)
    const res = await admin.suspend({ id: "ops@b2d", ip: "9.9.9.9" }, "ten_a", "abuse")
    expect(res.status).toBe("suspended")
    expect(svc.audits[0]).toMatchObject({
      actor: "ops@b2d",
      action: "tenant.suspend",
      tenant_id: "ten_a",
      ip: "9.9.9.9",
    })
  })

  it("impersonation is always logged", async () => {
    const { container, svc } = fake()
    const admin = new SuperAdminService(container)
    await admin.impersonate({ id: "ops@b2d" }, "ten_a")
    expect(svc.audits.some((a) => a.action === "tenant.impersonate")).toBe(true)
  })
})
