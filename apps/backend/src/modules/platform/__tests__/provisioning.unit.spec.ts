import { DryRunExecutor } from "../provider/executor/dry-run"
import {
  ComposeExecutor,
} from "../provider/executor/compose"
import { getInfraExecutor, __resetInfraExecutor } from "../provider/executor"
import { findStuckJobs, STUCK_AFTER_MS } from "../provisioning-service"

describe("InfraExecutor — dry-run (default, inert)", () => {
  it("reports not-configured and records intent in order", async () => {
    const ex = new DryRunExecutor()
    expect(ex.isConfigured()).toBe(false)
    const spec = { tenant_id: "ten_x", slug: "acme", db_name: "tenant_acme", port: 9401 }
    expect((await ex.createDatabase(spec)).ok).toBe(true)
    expect((await ex.runMigrations(spec)).ok).toBe(true)
    const boot = await ex.bootContainer(spec)
    expect(boot.ok).toBe(true)
    expect(boot.data?.container_ref).toBe("dryrun_acme")
    expect((await ex.destroyInstance({ tenant_id: "ten_x", container_ref: "dryrun_acme" })).ok).toBe(true)
    expect(ex.log.map((l) => l.op)).toEqual([
      "createDatabase",
      "runMigrations",
      "bootContainer",
      "destroyInstance",
    ])
  })
})

describe("InfraExecutor — selection by env", () => {
  const prev = process.env.PROVISIONER_MODE
  afterEach(() => {
    if (prev === undefined) delete process.env.PROVISIONER_MODE
    else process.env.PROVISIONER_MODE = prev
    __resetInfraExecutor()
  })

  it("defaults to dry-run when PROVISIONER_MODE is unset", () => {
    delete process.env.PROVISIONER_MODE
    __resetInfraExecutor()
    expect(getInfraExecutor().name).toBe("dry-run")
  })

  it("selects compose when PROVISIONER_MODE=compose", () => {
    process.env.PROVISIONER_MODE = "compose"
    __resetInfraExecutor()
    expect(getInfraExecutor().name).toBe("compose")
    expect(new ComposeExecutor().isConfigured()).toBe(true)
  })
})

describe("reconciler — findStuckJobs", () => {
  const now = 1_000_000_000
  it("flags running/pending/compensating jobs stale past the threshold", () => {
    const jobs = [
      { id: "a", status: "running", updated_at: new Date(now - STUCK_AFTER_MS - 1) },
      { id: "b", status: "running", updated_at: new Date(now - 1000) }, // fresh
      { id: "c", status: "completed", updated_at: new Date(now - STUCK_AFTER_MS - 1) },
      { id: "d", status: "compensating", updated_at: new Date(now - STUCK_AFTER_MS - 1) },
      { id: "e", status: "pending", updated_at: new Date(now - STUCK_AFTER_MS - 1) },
    ]
    expect(findStuckJobs(jobs, now).sort()).toEqual(["a", "d", "e"])
  })

  it("does not flag terminal (completed/failed) jobs", () => {
    const jobs = [
      { id: "x", status: "failed", updated_at: new Date(0) },
      { id: "y", status: "completed", updated_at: new Date(0) },
    ]
    expect(findStuckJobs(jobs, now)).toEqual([])
  })
})
