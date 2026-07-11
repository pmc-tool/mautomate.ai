import crypto from "crypto"
import { Modules } from "@medusajs/framework/utils"

import { getInfraExecutor } from "../../modules/platform/provider/executor"
import { PLATFORM_MODULE } from "../../modules/platform"
import { seedDemoContent } from "./_seed-demo"

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/** Guaranteed-valid strong password: upper + lower + digit, 20 chars. */
export const genPassword = () =>
  "Aa1" + crypto.randomBytes(12).toString("hex").slice(0, 17)

/** The tenant instance's DB/schema name (mirrors HostExecutor). */
export const tenantDbName = (slug: string) =>
  `tenant_${slug}`.replace(/[^a-z0-9_]/gi, "").toLowerCase()

/**
 * finishDedicatedInstance — the shared "make a freshly-provisioned dedicated
 * instance ready to use" step, used by BOTH the admin provision endpoint and the
 * public signup route (single source of truth, no drift between the two paths).
 *
 * It: (1) creates the owner's admin user INSIDE the tenant's own instance so they
 * can sign into their full Medusa admin; (2) restarts the instance so the running
 * Medusa picks up the freshly-created emailpass identity (a running instance
 * caches auth state); (3) seeds the instance (USD currency + US region + surfaces
 * the instance's publishable key onto the tenant row) so the storefront works
 * immediately. Best-effort seeding — a store owner can finish setup in their admin.
 */
export async function finishDedicatedInstance(
  scope: any,
  args: { slug: string; tenantId: string; adminEmail: string; adminPassword: string }
): Promise<{ admin: any; publishable_key?: string }> {
  const { slug, tenantId, adminEmail, adminPassword } = args
  const dbName = tenantDbName(slug)
  const exec = getInfraExecutor()

  let admin: any = null
  if (exec.createAdminUser) {
    const u = await exec.createAdminUser(dbName, adminEmail, adminPassword)
    admin = u.ok
      ? { email: adminEmail, admin_url: `https://${slug}.${ROOT}/app` }
      : { error: u.error }
  }

  const svc: any = scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(tenantId).catch(() => null)

  // A running Medusa caches its auth state and won't see the CLI-created admin
  // identity until it restarts. Restart (and wait for it to serve) before seeding.
  if (admin && !admin.error && exec.restartInstance && tenant?.container_ref) {
    await exec.restartInstance(tenant.container_ref, tenant.backend_url ?? undefined)
  }

  let publishable_key: string | undefined
  if (admin && !admin.error && tenant?.backend_url) {
    try {
      const base = tenant.backend_url.replace(/\/$/, "")
      let token: string | undefined
      for (let i = 0; i < 6 && !token; i++) {
        const login = await fetch(`${base}/auth/user/emailpass`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        }).then((r) => r.json()).catch(() => null)
        token = (login as any)?.token
        if (!token) await new Promise((r) => setTimeout(r, 2000))
      }
      if (token) {
        const H = { authorization: `Bearer ${token}`, "content-type": "application/json" }
        const stores = await fetch(`${base}/admin/stores?limit=1`, { headers: H }).then((r) => r.json())
        const storeId = (stores as any)?.stores?.[0]?.id
        if (storeId) {
          await fetch(`${base}/admin/stores/${storeId}`, {
            method: "POST", headers: H,
            body: JSON.stringify({ supported_currencies: [{ currency_code: "usd", is_default: true }, { currency_code: "eur" }] }),
          }).catch(() => undefined)
        }
        await fetch(`${base}/admin/regions`, {
          method: "POST", headers: H,
          body: JSON.stringify({ name: "United States", currency_code: "usd", countries: ["us"], payment_providers: ["pp_system_default"] }),
        }).catch(() => undefined)

        // Grant the owner the FIRST marketing "admin" role so their store's
        // /admin/marketing/* is unlocked out of the box (first-owner-guarded,
        // idempotent). Best-effort — never blocks provisioning.
        await fetch(`${base}/admin/marketing-setup/claim-owner`, {
          method: "POST", headers: H,
        }).catch(() => undefined)

        // Grant the owner the FIRST call-center "supervisor" role so their
        // /admin/call-center/* is unlocked out of the box (first-owner-guarded,
        // idempotent). Best-effort — never blocks provisioning.
        await fetch(`${base}/admin/call-center-bootstrap/owner`, {
          method: "POST", headers: H,
        }).catch(() => undefined)
        const keys = await fetch(`${base}/admin/api-keys?type=publishable&limit=1`, { headers: H }).then((r) => r.json())
        const pak = (keys as any)?.api_keys?.[0]?.token
        if (pak) {
          await svc.updateTenants({ id: tenant.id, publishable_key: pak })
          publishable_key = pak
        }

        // Seed demo content (categories / products / starter CMS pages) via the
        // tenant's admin API. Best-effort — never throws, never blocks provisioning.
        try {
          await seedDemoContent(base, H)
        } catch (e) {
          console.warn("[provision] demo-content seed failed (non-blocking):", e)
        }
      }
    } catch {
      // best-effort seeding
    }
  }

  return { admin, publishable_key }
}

/**
 * createMerchantIdentity — create the CONTROL-PLANE merchant account (actor_type
 * "merchant") + emailpass auth identity for a tenant owner, so they can sign into
 * the merchant hub (domains / billing / credits). Idempotent-ish: rolls back the
 * merchant row if the auth registration fails. Returns { ok, error }.
 */
export async function createMerchantIdentity(
  scope: any,
  args: { tenantId: string; email: string; password: string; name?: string }
): Promise<{ ok: boolean; error?: string; merchant_id?: string }> {
  const { tenantId, name } = args
  const email = args.email.trim().toLowerCase()
  const password = args.password
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const authService: any = scope.resolve(Modules.AUTH)

  let merchant: any
  try {
    ;[merchant] = await svc.createMerchants([
      { tenant_id: tenantId, email, name: name || null, status: "active" },
    ])
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "merchant create failed" }
  }

  try {
    const { authIdentity, error } = await authService.register("emailpass", { body: { email, password } })
    if (error || !authIdentity) {
      throw new Error(typeof error === "string" ? error : "could not set password")
    }
    await authService.updateAuthIdentities({
      id: authIdentity.id,
      app_metadata: { merchant_id: merchant.id, email },
    })
    return { ok: true, merchant_id: merchant.id }
  } catch (e: any) {
    // rollback the merchant row so a retry can succeed
    await svc.deleteMerchants([merchant.id]).catch(() => undefined)
    return { ok: false, error: e?.message ?? "auth register failed" }
  }
}
