import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../modules/platform"
import { trialInfo } from "../modules/platform/entitlements"

/**
 * Trial lifecycle sweep (monetization plan P2).
 *
 * Trials run 14 days + 7 days grace (banner, AI off, store still live).
 * Past grace the store is PAUSED: tenant.status flips to "suspended", which
 * the storefront middleware already serves as an offline page — no new
 * storefront code needed. The dashboard stays accessible for export/upgrade.
 *
 * Reactivation is the inverse: a paused free_trial tenant that has since
 * moved to a paid package is un-suspended here as a safety net (the billing
 * webhook normally does it first).
 *
 * Guardrails:
 *  - Gated on TRIAL_LIFECYCLE_ENFORCE=1 so the rollout is a config flip.
 *  - Only touches tenants whose package is free_trial AND status is "live"
 *    (pause) or paused-by-us (unpause) — a super-admin suspension
 *    (meta.paused_reason absent) is never overridden.
 */
export default async function trialLifecycleJob(container: MedusaContainer) {
  const logger: any = container.resolve("logger")
  if (process.env.TRIAL_LIFECYCLE_ENFORCE !== "1") {
    return
  }
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const tenants = await svc.listTenants(
      { package: "free_trial" },
      { take: 10000 }
    )
    const rows = (Array.isArray(tenants) ? tenants : [tenants]).filter(Boolean)
    let paused = 0
    for (const t of rows) {
      const info = trialInfo(t)
      if (info.state === "paused" && t.status === "live") {
        await svc.updateTenants({
          id: t.id,
          status: "suspended",
          meta: { ...(t.meta ?? {}), paused_reason: "trial_expired" },
        })
        paused += 1
      }
    }

    // Safety net: a tenant we paused that has since upgraded gets unpaused.
    const suspended = await svc.listTenants(
      { status: "suspended" },
      { take: 10000 }
    )
    let reactivated = 0
    for (const t of (Array.isArray(suspended) ? suspended : [suspended]).filter(
      Boolean
    )) {
      if (
        t.meta?.paused_reason === "trial_expired" &&
        t.package &&
        t.package !== "free_trial"
      ) {
        const meta = { ...(t.meta ?? {}) }
        delete meta.paused_reason
        await svc.updateTenants({ id: t.id, status: "live", meta })
        reactivated += 1
      }
    }

    if (paused || reactivated) {
      logger.info(
        `[trial-lifecycle] paused ${paused} expired trial(s), reactivated ${reactivated} upgraded store(s)`
      )
    }
  } catch (e: any) {
    logger.error(`[trial-lifecycle] ${e?.message ?? e}`)
  }
}

export const config = {
  name: "trial-lifecycle",
  schedule: "41 */6 * * *", // every 6 hours
}
