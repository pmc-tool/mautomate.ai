import crypto from "crypto"
import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"

import type {
  ExecResult,
  InfraExecutor,
  InstanceHandle,
  InstanceSpec,
} from "./types"

const run = promisify(execFile)
const BIG = { maxBuffer: 64 * 1024 * 1024 } // migrations emit a lot of output

/**
 * HostExecutor — the process-per-tenant substrate (PROVISIONER_MODE=host).
 *
 * Each tenant gets its OWN Postgres database (on the shared cluster) and its OWN
 * Medusa process (pm2), sharing the built code + node_modules — exactly how
 * Forever Finds already runs, generalized to N stores. This is the proven VM
 * substrate for the first tenants; a container/orchestrator executor is the
 * scale-out path (swapped in via PROVISIONER_MODE without touching the saga).
 *
 * Runs inside the control-plane backend, which holds infra privileges (psql,
 * the shared build path, pm2). All shell-outs are argument arrays (never string
 * concat) and every method is no-throw (returns ExecResult).
 */
export class HostExecutor implements InfraExecutor {
  readonly name = "host"
  private readonly pgAdminUrl: string
  private readonly serverPath: string
  // Density model. "database" = a Postgres DB per tenant (legacy, strongest
  // separation). "schema" = one SHARED database, a Postgres SCHEMA per tenant
  // (many stores per cluster) via Medusa's native databaseSchema/search_path.
  // Default "database" so existing tenants are unaffected.
  private readonly isolation: "schema" | "database"
  private readonly sharedTenantDb: string
  // Public root domain used to derive each tenant's storefront URL / brand.
  private readonly rootDomain: string
  // Stable on-disk home for per-tenant MARKETING_SECRET_KEY files, so a key
  // generated once is reused on every subsequent boot/restart/re-provision.
  private readonly secretDir: string

  constructor() {
    // Admin connection for CREATE/DROP DATABASE — the control-plane DB URL with
    // the database swapped to `postgres`. Override with PROVISIONER_PG_ADMIN_URL.
    this.pgAdminUrl =
      process.env.PROVISIONER_PG_ADMIN_URL ??
      (process.env.DATABASE_URL ?? "").replace(/\/[^/?]+(\?|$)/, "/postgres$1")
    // The shared built server the tenant process runs from.
    this.serverPath =
      process.env.PROVISIONER_SERVER_PATH ??
      "/home/ratul/brandtodoor/apps/backend/.medusa/server"
    this.isolation = process.env.TENANT_ISOLATION === "schema" ? "schema" : "database"
    this.sharedTenantDb = process.env.PROVISIONER_TENANT_DB ?? "b2d_tenants"
    this.rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
    // Sits beside the built server (apps/backend/tenant-secrets), which survives
    // a rebuild of .medusa/server. Override with PROVISIONER_TENANT_SECRET_DIR.
    this.secretDir =
      process.env.PROVISIONER_TENANT_SECRET_DIR ??
      path.join(this.serverPath, "..", "..", "tenant-secrets")
  }

  /** The database a tenant's process connects to (shared in schema mode). */
  private tenantDbName(spec: { db_name: string }): string {
    return this.isolation === "schema" ? this.sharedTenantDb : spec.db_name
  }

  /**
   * The DATABASE_URL a tenant's process/migrations use. In schema mode we pin
   * `search_path` at the CONNECTION level (libpq `options`) so EVERY connection
   * — including each module's own migrator — creates + reads its tables in the
   * tenant's schema (Medusa's `databaseSchema` alone only covers link tables;
   * per-module migrations otherwise leak into `public`). `,public` keeps shared
   * extensions/types reachable.
   */
  private tenantConnUrl(spec: { db_name: string }): string {
    const base = this.dbUrl(this.tenantDbName(spec))
    if (this.isolation !== "schema") return base
    const opts = encodeURIComponent(`-c search_path=${spec.db_name},public`)
    return base.includes("?") ? `${base}&options=${opts}` : `${base}?options=${opts}`
  }

  isConfigured(): boolean {
    return process.env.PROVISIONER_MODE === "host"
  }

  /** Tenant DB connection string (admin URL with the db swapped). */
  private dbUrl(dbName: string): string {
    return this.pgAdminUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
  }

  private pmName(spec: { slug: string }): string {
    return `tenant_${spec.slug}`.replace(/[^a-z0-9_]/gi, "").toLowerCase()
  }

  /** Title-case a slug ("acme-store" -> "Acme Store") as a brand-name fallback. */
  private slugToBrand(slug: string): string {
    const words = slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
    return words || slug
  }

  /**
   * A stable, UNIQUE-per-tenant MARKETING_SECRET_KEY. Generated exactly once
   * (crypto.randomBytes(32) base64) and persisted to a per-tenant file, so every
   * later boot/restart/re-provision reuses the SAME key. A shared key would let
   * one tenant forge another's unsubscribe/click tokens and decrypt their
   * credentials; a fresh key each boot would invalidate every already-issued
   * token. No-throw: on a filesystem error it degrades to a freshly generated
   * key rather than blocking provisioning.
   */
  private tenantMarketingSecret(spec: InstanceSpec): string {
    const file = path.join(this.secretDir, `${this.pmName(spec)}.key`)
    try {
      const existing = fs.readFileSync(file, "utf8").trim()
      if (existing) {
        return existing
      }
    } catch {
      // no file yet — fall through and generate one
    }
    const key = crypto.randomBytes(32).toString("base64")
    try {
      fs.mkdirSync(this.secretDir, { recursive: true })
      fs.writeFileSync(file, key, { encoding: "utf8", mode: 0o600 })
    } catch {
      // best-effort persistence — the instance still boots with this key
    }
    return key
  }

  /**
   * Per-tenant marketing env injected into every tenant process so its
   * marketing stack is scoped to THAT store (storefront URL, brand, from-address,
   * its own backend URL, and its own unique signing/credential secret).
   */
  private marketingEnv(spec: InstanceSpec): NodeJS.ProcessEnv {
    const port = spec.port ?? 9000
    const domain = `${spec.slug}.${this.rootDomain}`.toLowerCase()
    const storeUrl = `https://${domain}`
    const brandName =
      spec.name && spec.name.trim() ? spec.name.trim() : this.slugToBrand(spec.slug)
    return {
      MARKETING_STORE_URL: storeUrl,
      MARKETING_BRAND_NAME: brandName,
      SMTP_FROM: `${brandName} <no-reply@${domain}>`,
      MEDUSA_BACKEND_URL: `http://127.0.0.1:${port}`,
      MARKETING_SECRET_KEY: this.tenantMarketingSecret(spec),
    }
  }

  /** Env every tenant process/migration needs. Per-tenant secrets land in Phase 3. */
  private tenantEnv(spec: InstanceSpec): NodeJS.ProcessEnv {
    return {
      ...process.env,
      DATABASE_URL: this.tenantConnUrl(spec),
      // In schema mode the tenant's tables + connection search_path live in this
      // Postgres schema of the shared database (Medusa reads projectConfig.databaseSchema).
      ...(this.isolation === "schema" ? { DB_SCHEMA: spec.db_name } : {}),
      PORT: String(spec.port ?? 9000),
      TENANT_ID: spec.tenant_id,
      NODE_ENV: "production",
      FILE_PROVIDER: "local",
      MEDUSA_DISABLE_TELEMETRY: "true",
      // Metering: the instance charges its OWN control-plane wallet remotely.
      // TENANT_ID (above) + these two turn instance metering ON in the instance;
      // the control plane exposes /platform/internal/meter guarded by the secret.
      PLATFORM_CONTROL_URL:
        process.env.PLATFORM_CONTROL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 9500}`,
      PLATFORM_METER_SECRET: process.env.PLATFORM_METER_SECRET ?? "",
      // PLATFORM_KEK / JWT_SECRET / COOKIE_SECRET flow from the control plane's
      // process.env (spread above); explicit per-tenant secrets go in spec.env.
      // Per-tenant marketing scope (storefront URL, brand, from, unique secret).
      ...this.marketingEnv(spec),
      ...(spec.env ?? {}),
    }
  }

  async createDatabase(spec: InstanceSpec): Promise<ExecResult<{ db_name: string }>> {
    try {
      if (this.isolation === "schema") {
        // Ensure the ONE shared tenant database exists, then a schema per tenant.
        const { stdout } = await run(
          "psql",
          [this.pgAdminUrl, "-tAc", `SELECT 1 FROM pg_database WHERE datname='${this.sharedTenantDb}'`],
          BIG
        )
        if (stdout.trim() !== "1") {
          await run(
            "psql",
            [this.pgAdminUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${this.sharedTenantDb}"`],
            BIG
          )
        }
        // db_name doubles as the schema name (tenant_<slug>).
        await run(
          "psql",
          [this.dbUrl(this.sharedTenantDb), "-v", "ON_ERROR_STOP=1", "-c", `CREATE SCHEMA IF NOT EXISTS "${spec.db_name}"`],
          BIG
        )
        return { ok: true, data: { db_name: spec.db_name } }
      }
      // database mode: idempotent create-if-absent
      const { stdout } = await run(
        "psql",
        [this.pgAdminUrl, "-tAc", `SELECT 1 FROM pg_database WHERE datname='${spec.db_name}'`],
        BIG
      )
      if (stdout.trim() !== "1") {
        await run(
          "psql",
          [this.pgAdminUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${spec.db_name}"`],
          BIG
        )
      }
      return { ok: true, data: { db_name: spec.db_name } }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "createDatabase failed" }
    }
  }

  async runMigrations(spec: InstanceSpec): Promise<ExecResult<void>> {
    try {
      await run("npx", ["medusa", "db:migrate"], {
        cwd: this.serverPath,
        env: this.tenantEnv(spec),
        ...BIG,
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "runMigrations failed" }
    }
  }

  async bootContainer(spec: InstanceSpec): Promise<ExecResult<InstanceHandle>> {
    const name = this.pmName(spec)
    const port = spec.port ?? 9000
    try {
      // replace any prior process of the same name (idempotent boot)
      await run("pm2", ["delete", name]).catch(() => undefined)
      await run(
        "pm2",
        ["start", "npm", "--name", name, "--cwd", this.serverPath, "--", "run", "start"],
        { env: this.tenantEnv(spec), ...BIG }
      )
      await run("pm2", ["save"]).catch(() => undefined)
      // Wait until the instance actually serves before returning, so "live" is
      // truthful and the provision seeding (region/publishable key) can proceed.
      const backendUrl = `http://127.0.0.1:${port}`
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`${backendUrl}/health`)
          if (r.ok) break
        } catch {}
        await new Promise((res) => setTimeout(res, 1500))
      }
      return {
        ok: true,
        data: { container_ref: name, backend_url: backendUrl, db_name: spec.db_name },
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "bootContainer failed" }
    }
  }

  /** Stop a tenant's process (suspend) — keeps its DB + pm2 entry, just halts it. */
  async stopInstance(containerRef: string): Promise<ExecResult<void>> {
    try {
      await run("pm2", ["stop", containerRef])
      await run("pm2", ["save"]).catch(() => undefined)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "stopInstance failed" }
    }
  }

  /** Start a previously-stopped tenant process (resume). */
  async startInstance(containerRef: string): Promise<ExecResult<void>> {
    try {
      await run("pm2", ["start", containerRef])
      await run("pm2", ["save"]).catch(() => undefined)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "startInstance failed" }
    }
  }

  /**
   * Restart a tenant instance and wait until it serves again. Used after
   * creating the first admin user via the CLI: a running Medusa caches its auth
   * state and won't see the new emailpass identity until it restarts.
   */
  async restartInstance(containerRef: string, backendUrl?: string): Promise<ExecResult<void>> {
    try {
      await run("pm2", ["restart", containerRef])
      if (backendUrl) {
        for (let i = 0; i < 30; i++) {
          try {
            const r = await fetch(`${backendUrl}/health`)
            if (r.ok) break
          } catch {}
          await new Promise((res) => setTimeout(res, 1500))
        }
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "restartInstance failed" }
    }
  }

  async destroyInstance(ref: {
    tenant_id: string
    container_ref?: string
    db_name?: string
  }): Promise<ExecResult<void>> {
    try {
      if (ref.container_ref) {
        await run("pm2", ["delete", ref.container_ref]).catch(() => undefined)
        await run("pm2", ["save"]).catch(() => undefined)
      }
      if (ref.db_name) {
        if (this.isolation === "schema") {
          // schema mode: drop just this tenant's schema in the shared database
          await run(
            "psql",
            [this.dbUrl(this.sharedTenantDb), "-c", `DROP SCHEMA IF EXISTS "${ref.db_name}" CASCADE`],
            BIG
          ).catch(() => undefined)
        } else {
          // database mode: terminate connections then drop the database
          await run(
            "psql",
            [
              this.pgAdminUrl,
              "-c",
              `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${ref.db_name}'`,
            ],
            BIG
          ).catch(() => undefined)
          await run("psql", [this.pgAdminUrl, "-c", `DROP DATABASE IF EXISTS "${ref.db_name}"`], BIG).catch(
            () => undefined
          )
        }
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "destroyInstance failed" }
    }
  }

  /** Create an admin user INSIDE a tenant's instance DB (so the owner can log in). */
  async createAdminUser(
    dbName: string,
    email: string,
    password: string
  ): Promise<ExecResult<{ email: string }>> {
    try {
      await run("npx", ["medusa", "user", "-e", email, "-p", password], {
        cwd: this.serverPath,
        env: {
          ...process.env,
          DATABASE_URL: this.tenantConnUrl({ db_name: dbName }),
          ...(this.isolation === "schema" ? { DB_SCHEMA: dbName } : {}),
          NODE_ENV: "production",
          MEDUSA_DISABLE_TELEMETRY: "true",
          FILE_PROVIDER: "local",
        },
        ...BIG,
      })
      return { ok: true, data: { email } }
    } catch (e: any) {
      const msg = String(e?.message ?? "")
      // "already exists" is fine (idempotent re-provision)
      if (/already exists/i.test(msg)) return { ok: true, data: { email } }
      return { ok: false, error: msg || "createAdminUser failed" }
    }
  }

  async healthcheck(handle: { backend_url: string }): Promise<ExecResult<{ live: boolean }>> {
    try {
      const res = await fetch(`${handle.backend_url}/health`)
      return { ok: true, data: { live: res.ok } }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "healthcheck failed" }
    }
  }
}

export default HostExecutor
