import {
  planForeverFindsRegistration,
  registerForeverFinds,
  unregisterForeverFinds,
  FF_DOMAIN,
  FF_DATA_TENANT,
} from "../migration/foreverfinds"

describe("Forever Finds migration (map-to-default)", () => {
  it("plan performs NO data remap — every step is reversible", () => {
    const plan = planForeverFindsRegistration()
    expect(plan.every((s) => s.reversible)).toBe(true)
    expect(plan.some((s) => /NO remap/.test(s.step) && s.mutates === "none")).toBe(true)
    // nothing in the plan mutates the tenant data rows
    expect(plan.some((s) => s.mutates === "control_plane")).toBe(true)
  })

  function fake() {
    const tenants: any[] = []
    const domains: any[] = []
    const svc = {
      tenants,
      domains,
      async listTenants(f: any) {
        return tenants.filter((t) => (f.slug ? t.slug === f.slug : true))
      },
      async createTenants(rows: any[]) {
        const c = rows.map((r, i) => ({ id: `ten_ff${tenants.length + i}`, ...r }))
        tenants.push(...c)
        return c
      },
      async deleteTenants(ids: string[]) {
        for (const id of ids) tenants.splice(tenants.findIndex((t) => t.id === id), 1)
      },
      async listTenantDomains(f: any) {
        return domains.filter((d) => (f.domain ? d.domain === f.domain : true))
      },
      async createTenantDomains(rows: any[]) {
        domains.push(...rows.map((r, i) => ({ id: `tdom_ff${domains.length + i}`, ...r })))
      },
      async deleteTenantDomains(ids: string[]) {
        for (const id of ids) domains.splice(domains.findIndex((d) => d.id === id), 1)
      },
    }
    return { container: { resolve: () => svc } as any, svc }
  }

  it("registers FF additively: tenant row + hostname, data stays 'default'", async () => {
    const { container, svc } = fake()
    const res = await registerForeverFinds(container, { backend_url: "http://ff" })
    expect(res.data_tenant).toBe(FF_DATA_TENANT) // "default" — no remap
    expect(res.domain).toBe(FF_DOMAIN)
    expect(svc.tenants[0].meta.data_tenant_id).toBe("default")
    expect(svc.domains[0].domain).toBe(FF_DOMAIN)
  })

  it("is idempotent (re-register doesn't duplicate)", async () => {
    const { container, svc } = fake()
    await registerForeverFinds(container)
    await registerForeverFinds(container)
    expect(svc.tenants.length).toBe(1)
    expect(svc.domains.length).toBe(1)
  })

  it("rollback unregisters cleanly (data never touched)", async () => {
    const { container, svc } = fake()
    await registerForeverFinds(container)
    await unregisterForeverFinds(container)
    expect(svc.tenants.length).toBe(0)
    expect(svc.domains.length).toBe(0)
  })
})
