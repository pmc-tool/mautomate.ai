import { execFile } from "child_process"
import { promisify } from "util"

import type {
  ExecResult,
  InfraExecutor,
  InstanceHandle,
  InstanceSpec,
} from "./types"

const run = promisify(execFile)

/**
 * ComposeExecutor — the Docker-Compose substrate executor (the Phase 0
 * decision: Compose on the current VM for the first ~10 tenants). Each tenant
 * is a compose project (`-p ff_<slug>`) stamped from docker/docker-compose.tenant.yml.
 *
 * Enabled only when `PROVISIONER_MODE=compose`; otherwise the platform uses the
 * dry-run executor. All shell-outs are argument-arrays (never string-concat) to
 * avoid injection, and every method is no-throw.
 *
 * NOTE: this holds infra privileges and is intended to run as the dedicated
 * provisioner, not inside the shared tenant backend.
 */
export class ComposeExecutor implements InfraExecutor {
  readonly name = "compose"
  private readonly composeFile: string
  private readonly pgAdminUrl?: string

  constructor() {
    this.composeFile =
      process.env.PROVISIONER_COMPOSE_FILE ??
      "docker/docker-compose.tenant.yml"
    this.pgAdminUrl = process.env.PROVISIONER_PG_ADMIN_URL
  }

  isConfigured(): boolean {
    return process.env.PROVISIONER_MODE === "compose"
  }

  private project(spec: { slug: string }): string {
    return `ff_${spec.slug}`.replace(/[^a-z0-9_]/gi, "").toLowerCase()
  }

  private env(spec: InstanceSpec): NodeJS.ProcessEnv {
    return {
      ...process.env,
      TENANT_ID: spec.tenant_id,
      TENANT_DB_NAME: spec.db_name,
      TENANT_PORT: String(spec.port ?? 9000),
      ...(spec.env ?? {}),
    }
  }

  async createDatabase(
    spec: InstanceSpec
  ): Promise<ExecResult<{ db_name: string }>> {
    // With per-tenant compose, Postgres is created by the `db` service on `up`.
    // If an external managed cluster is used instead, PROVISIONER_PG_ADMIN_URL
    // drives a `createdb`; here we treat DB creation as part of `bootContainer`.
    if (!this.pgAdminUrl) {
      return { ok: true, data: { db_name: spec.db_name } }
    }
    try {
      await run("createdb", ["-d", this.pgAdminUrl, spec.db_name])
      return { ok: true, data: { db_name: spec.db_name } }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "createdb failed" }
    }
  }

  async runMigrations(_spec: InstanceSpec): Promise<ExecResult<void>> {
    // Migrations run inside the container command (`medusa db:migrate && start`)
    // per the compose template, so this is a no-op success here.
    return { ok: true }
  }

  async bootContainer(
    spec: InstanceSpec
  ): Promise<ExecResult<InstanceHandle>> {
    const project = this.project(spec)
    try {
      await run(
        "docker",
        [
          "compose",
          "-f",
          this.composeFile,
          "-p",
          project,
          "up",
          "-d",
          "--build",
        ],
        { env: this.env(spec) }
      )
      return {
        ok: true,
        data: {
          container_ref: project,
          backend_url: `http://127.0.0.1:${spec.port ?? 9000}`,
          db_name: spec.db_name,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "compose up failed" }
    }
  }

  async destroyInstance(ref: {
    tenant_id: string
    container_ref?: string
    db_name?: string
  }): Promise<ExecResult<void>> {
    if (!ref.container_ref) {
      return { ok: true } // nothing booted
    }
    try {
      await run("docker", [
        "compose",
        "-f",
        this.composeFile,
        "-p",
        ref.container_ref,
        "down",
        "-v",
      ])
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "compose down failed" }
    }
  }

  async healthcheck(handle: {
    backend_url: string
  }): Promise<ExecResult<{ live: boolean }>> {
    try {
      const res = await fetch(`${handle.backend_url}/health`)
      return { ok: true, data: { live: res.ok } }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "healthcheck failed" }
    }
  }
}

export default ComposeExecutor
