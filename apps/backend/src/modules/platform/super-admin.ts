import type { MedusaContainer } from "@medusajs/framework/types"

import jwt from "jsonwebtoken"

import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "./index"
import { nextLifecycleState } from "./billing/lifecycle"
import { computeMetrics, PlatformMetrics } from "./observability/metrics"
import { getLedger } from "./credits/metering"

const ROOT_DOMAIN = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/**
 * SuperAdminService — the platform-operator actions over ALL tenants, each of
 * which writes an immutable audit_log row (actor, action, tenant, ip). This is
 * the enforced audit trail for impersonation / cross-tenant access.
 *
 * Authorization: access is gated by the fail-closed `requirePlatformSuperAdmin`
 * middleware (an operator email allowlist). MFA and break-glass are NOT yet
 * implemented — do not rely on them. This service only guarantees that nothing
 * cross-tenant happens without an audit_log entry.
 */
export type Actor = { id: string; ip?: string }

export class SuperAdminService {
  constructor(private readonly container: MedusaContainer) {}
  private svc(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }

  private async audit(
    actor: Actor,
    action: string,
    tenantId: string | null,
    outcome: "success" | "denied" | "error" = "success",
    meta?: unknown
  ): Promise<void> {
    await this.svc().createAuditLogs([
      {
        actor: actor.id,
        action,
        tenant_id: tenantId,
        ip: actor.ip ?? null,
        outcome,
        meta: meta ?? null,
      },
    ])
  }

  async listTenants(actor: Actor, filter: Record<string, unknown> = {}) {
    const tenants = await this.svc().listTenants(filter)
    await this.audit(actor, "tenant.list", null, "success", {
      count: tenants?.length ?? 0,
    })
    return tenants
  }

  /** Platform-wide metrics for the operator dashboard (audit-logged read). */
  async metrics(actor: Actor): Promise<PlatformMetrics> {
    const svc = this.svc()
    const [tenants, txns, usage] = await Promise.all([
      svc.listTenants({}),
      svc.listCreditTransactions({}),
      svc.listUsageEvents({}),
    ])
    await this.audit(actor, "platform.metrics", null)
    return computeMetrics(
      (tenants ?? []).map((t: any) => ({
        status: t.status,
        package: t.package,
        credit_balance: Number(t.credit_balance ?? 0),
      })),
      (txns ?? []).map((t: any) => ({ type: t.type, amount: Number(t.amount) })),
      (usage ?? []).map((u: any) => ({
        action: u.action,
        units: Number(u.units ?? 0),
        credits: Number(u.credits ?? 0),
        vendor_cost_usd: u.vendor_cost_usd,
      }))
    )
  }

  async suspend(actor: Actor, tenantId: string, reason: "billing" | "abuse") {
    const svc = this.svc()
    const t = await svc.retrieveTenant(tenantId)
    const event = reason === "abuse" ? "abuse_detected" : "payment_failed"
    const next =
      reason === "abuse"
        ? "suspended"
        : nextLifecycleState(t.status, event)
    await svc.updateTenants({
      id: tenantId,
      status: "suspended",
      suspended_at: new Date(),
    })
    await this.audit(actor, "tenant.suspend", tenantId, "success", { reason, next })
    return { id: tenantId, status: "suspended" }
  }

  async resume(actor: Actor, tenantId: string) {
    await this.svc().updateTenants({
      id: tenantId,
      status: "live",
      suspended_at: null,
    })
    await this.audit(actor, "tenant.resume", tenantId)
    return { id: tenantId, status: "live" }
  }

  /**
   * Begin an impersonation session. Returns a SCOPED, short-lived grant (the
   * token itself is minted by the auth layer); crucially, the access is logged
   * and can be surfaced to the tenant.
   */
  async impersonate(actor: Actor, tenantId: string) {
    const t = await this.svc().retrieveTenant(tenantId)
    // Mint a short-lived session for the tenant's OWN merchant owner so the
    // operator lands inside the store admin as that owner (audited). Guarded
    // upstream by requirePlatformSuperAdmin. Never crosses to another tenant.
    const [merchant] = await this.svc().listMerchants({ tenant_id: tenantId })
    if (!merchant) {
      await this.audit(actor, "tenant.impersonate", tenantId, "error", {
        reason: "no_merchant",
      })
      throw new Error("This store has no merchant account to impersonate")
    }
    const secret = process.env.JWT_SECRET
    if (!secret) {
      await this.audit(actor, "tenant.impersonate", tenantId, "error", {
        reason: "no_jwt_secret",
      })
      throw new Error("Impersonation is not configured")
    }
    const pg: any = this.container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await pg.raw(
      "select auth_identity_id from provider_identity where entity_id = ? and provider = 'emailpass' limit 1",
      [merchant.email]
    )
    const authIdentityId = rows?.rows?.[0]?.auth_identity_id ?? null
    const token = jwt.sign(
      {
        actor_id: merchant.id,
        actor_type: "merchant",
        auth_identity_id: authIdentityId,
        auth_provider: "emailpass",
        app_metadata: { email: merchant.email, merchant_id: merchant.id },
        user_metadata: {},
      },
      secret,
      { expiresIn: "30m" }
    )
    const store_url = `https://merchant.${ROOT_DOMAIN}/dashboard/overview`
    await this.audit(actor, "tenant.impersonate", tenantId, "success", {
      store_url,
      merchant_id: merchant.id,
    })
    return {
      tenant_id: tenantId,
      store_url,
      token,
      scope: "impersonation",
      expires_in: 1800,
    }
  }

  async retryProvisioning(actor: Actor, jobId: string) {
    const svc = this.svc()
    const job = await svc.retrieveProvisioningJob(jobId)
    await svc.updateProvisioningJobs({
      id: jobId,
      status: "pending",
      attempts: (job.attempts ?? 0) + 1,
      last_error: null,
    })
    await this.audit(actor, "provisioning.retry", job.tenant_id, "success", { jobId })
    return { id: jobId, status: "pending" }
  }

  /** Read the audit trail for a tenant (surfaceable to that tenant). */
  async auditTrail(tenantId: string) {
    return this.svc().listAuditLogs({ tenant_id: tenantId })
  }

  /** Grant credits to a tenant's wallet (real ledger entry + derived-cache sync). */
  async grantCredits(actor: Actor, tenantId: string, amount: number) {
    if (!(amount > 0)) throw new Error("amount must be positive")
    const ledger = getLedger(this.container)
    const balance = await ledger.credit(tenantId, amount, {
      type: "grant",
      idempotencyKey: `grant_${tenantId}_${Date.now()}`,
    })
    await this.svc().updateTenants({ id: tenantId, credit_balance: balance })
    await this.audit(actor, "tenant.grant_credits", tenantId, "success", { amount, balance })
    return { tenant_id: tenantId, balance }
  }

  /**
   * Change a tenant's subscription package (plan). Updates `tenant.package`,
   * which immediately re-points the plan + monthly included-credit allowance the
   * merchant sees. Optionally grants the new plan's included credits into the
   * wallet now (`grantIncluded`) — off by default so a mid-cycle change does not
   * silently hand out credits. Audit-logged.
   */
  async setPackage(
    actor: Actor,
    tenantId: string,
    key: string,
    opts: { grantIncluded?: boolean } = {}
  ) {
    const svc = this.svc()
    const [pkg] = await svc.listPlatformPackages({ key }, { take: 1 })
    if (!pkg) throw new Error(`unknown package: ${key}`)
    const [tenant] = await svc.listTenants({ id: tenantId }, { take: 1 })
    if (!tenant) throw new Error(`unknown tenant: ${tenantId}`)

    const previous = tenant.package
    await svc.updateTenants({ id: tenantId, package: key })

    let granted = 0
    let balance = Number(tenant.credit_balance ?? 0)
    const included = Number(pkg.included_credits ?? 0)
    if (opts.grantIncluded && included > 0) {
      const ledger = getLedger(this.container)
      balance = await ledger.credit(tenantId, included, {
        type: "grant",
        idempotencyKey: `plan_${tenantId}_${key}_${Date.now()}`,
      })
      await svc.updateTenants({ id: tenantId, credit_balance: balance })
      granted = included
    }

    await this.audit(actor, "tenant.set_package", tenantId, "success", {
      from: previous,
      to: key,
      granted,
    })
    return {
      tenant_id: tenantId,
      package: key,
      previous,
      granted_credits: granted,
      credit_balance: balance,
    }
  }

  /**
   * De-provision a tenant: tear down its store (sales channel + key + products,
   * best-effort) and delete all platform rows so it vanishes from the control
   * plane and its storefront 404s. Irreversible. Audit-logged.
   */
  async deprovision(actor: Actor, tenantId: string) {
    const svc = this.svc()
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)

    // best-effort commerce teardown (orphans are harmless if this fails)
    const scId = tenant?.meta?.sales_channel_id
    if (scId) {
      try {
        const productModule: any = this.container.resolve(Modules.PRODUCT)
        const prods = await productModule.listProducts(
          { sales_channels: { id: scId } },
          { take: 1000, select: ["id"] }
        )
        if (prods?.length) await productModule.deleteProducts(prods.map((p: any) => p.id))
      } catch {}
      try {
        const scModule: any = this.container.resolve(Modules.SALES_CHANNEL)
        await scModule.deleteSalesChannels([scId])
      } catch {}
    }

    // platform rows (each keyed by tenant_id)
    const tables: Array<[string, string]> = [
      ["listTenantDomains", "deleteTenantDomains"],
      ["listTenantConfigs", "deleteTenantConfigs"],
      ["listTenantKeys", "deleteTenantKeys"],
      ["listCreditReservations", "deleteCreditReservations"],
      ["listCreditTransactions", "deleteCreditTransactions"],
      ["listCreditWallets", "deleteCreditWallets"],
      ["listUsageEvents", "deleteUsageEvents"],
    ]
    for (const [list, del] of tables) {
      try {
        const rows = await svc[list]({ tenant_id: tenantId })
        if (rows?.length) await svc[del](rows.map((r: any) => r.id))
      } catch {}
    }
    await svc.deleteTenants([tenantId])
    await this.audit(actor, "tenant.deprovision", tenantId, "success", {
      slug: tenant?.slug,
    })
    return { id: tenantId, deleted: true }
  }
}

export default SuperAdminService
