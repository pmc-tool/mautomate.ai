import type {
  ExecResult,
  InfraExecutor,
  InstanceHandle,
  InstanceSpec,
} from "./types"

/**
 * DryRunExecutor — the DEFAULT executor. It performs no real infra actions; it
 * records intent and returns deterministic success so the whole provisioning
 * saga can run, be tested, and be demoed end-to-end WITHOUT a Docker host or
 * live orchestrator. This keeps the platform inert until a real executor
 * (compose/orchestrator) is configured via env.
 *
 * The `log` is inspectable in tests to assert the saga called the right steps
 * in order and that compensations tore things down.
 */
export class DryRunExecutor implements InfraExecutor {
  readonly name = "dry-run"
  readonly log: Array<{ op: string; tenant_id: string; detail?: unknown }> = []

  isConfigured(): boolean {
    return false
  }

  private record(op: string, tenant_id: string, detail?: unknown) {
    this.log.push({ op, tenant_id, detail })
  }

  async createDatabase(
    spec: InstanceSpec
  ): Promise<ExecResult<{ db_name: string }>> {
    this.record("createDatabase", spec.tenant_id, spec.db_name)
    return { ok: true, data: { db_name: spec.db_name } }
  }

  async runMigrations(spec: InstanceSpec): Promise<ExecResult<void>> {
    this.record("runMigrations", spec.tenant_id)
    return { ok: true }
  }

  async bootContainer(
    spec: InstanceSpec
  ): Promise<ExecResult<InstanceHandle>> {
    this.record("bootContainer", spec.tenant_id, spec.port)
    return {
      ok: true,
      data: {
        container_ref: `dryrun_${spec.slug}`,
        backend_url: `http://dry-run.local:${spec.port ?? 9000}`,
        db_name: spec.db_name,
      },
    }
  }

  async destroyInstance(ref: {
    tenant_id: string
    container_ref?: string
    db_name?: string
  }): Promise<ExecResult<void>> {
    this.record("destroyInstance", ref.tenant_id, ref.container_ref)
    return { ok: true }
  }

  async healthcheck(): Promise<ExecResult<{ live: boolean }>> {
    return { ok: true, data: { live: true } }
  }
}

export default DryRunExecutor
