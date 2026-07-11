/**
 * InfraExecutor — the minimal-privilege boundary that actually creates a
 * tenant's Postgres database, runs migrations, and boots/tears-down its
 * container. The Medusa app NEVER touches the Docker socket directly; it calls
 * this interface, and only a dedicated executor implementation holds infra
 * privileges (the review's "executor, not docker.sock in the app").
 *
 * Every method is NO-THROW and returns an `ExecResult` (mirrors the domains
 * RegistrarProvider contract) so the provisioning saga can branch/compensate on
 * `ok` rather than catch exceptions across a distributed boundary.
 */
export type ExecResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
}

export type InstanceSpec = {
  tenant_id: string
  slug: string
  /** human store name, used to derive per-tenant marketing brand/from defaults */
  name?: string
  db_name: string
  /** the host port the container is published on (edge routes to it) */
  port?: number
  /** env injected into the container (TENANT_ID, DATABASE_URL, PLATFORM_KEK, ...) */
  env?: Record<string, string>
}

export type InstanceHandle = {
  container_ref: string
  backend_url: string
  db_name: string
}

export interface InfraExecutor {
  /** stable id for logs / provisioning_job.meta */
  readonly name: string
  /** is a real (non dry-run) executor configured? */
  isConfigured(): boolean

  createDatabase(spec: InstanceSpec): Promise<ExecResult<{ db_name: string }>>
  runMigrations(spec: InstanceSpec): Promise<ExecResult<void>>
  bootContainer(spec: InstanceSpec): Promise<ExecResult<InstanceHandle>>
  /** idempotent teardown — used by compensations and de-provisioning */
  destroyInstance(
    ref: { tenant_id: string; container_ref?: string; db_name?: string }
  ): Promise<ExecResult<void>>
  /** liveness probe for the reconciler */
  healthcheck(handle: { backend_url: string }): Promise<ExecResult<{ live: boolean }>>
  /** create an admin user inside a tenant instance DB (substrate-dependent) */
  createAdminUser?(
    dbName: string,
    email: string,
    password: string
  ): Promise<ExecResult<{ email: string }>>
  /** halt a tenant's running instance (suspend); keep its DB + registration */
  stopInstance?(containerRef: string): Promise<ExecResult<void>>
  /** start a previously-stopped tenant instance (resume) */
  startInstance?(containerRef: string): Promise<ExecResult<void>>
  /** restart a running instance (e.g. to pick up a freshly-created admin identity) */
  restartInstance?(containerRef: string, backendUrl?: string): Promise<ExecResult<void>>
}
