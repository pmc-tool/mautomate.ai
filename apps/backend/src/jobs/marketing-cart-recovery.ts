import type { MedusaContainer } from "@medusajs/framework/types"

import { runRecoverySweep } from "../modules/marketing/recovery/recovery-service"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * marketing-cart-recovery (scheduled sweep, every 15 minutes).
 *
 * Drives the claim-first abandoned-cart recovery engine for every active
 * tenant: enrolls idle carts, then claims and steps due rows through the
 * 3-email escalation. The runner owns both kill switches (MARKETING_ENABLED +
 * durable automation_abandoned_cart toggle) and returns zeros when gated, so
 * this job is inert until recovery is explicitly enabled.
 *
 * NEVER throws out of the job — a failure is logged and the next sweep retries.
 */
export default async function marketingCartRecoveryJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const summary = await runForEachTenant(
      container,
      "cart-recovery sweep",
      runRecoverySweep
    )
    if (summary.enrolled > 0 || summary.stepped > 0 || summary.recovered > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[marketing] cart-recovery sweep: enrolled=${summary.enrolled} stepped=${summary.stepped} recovered=${summary.recovered} failed=${summary.failed}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[marketing] cart-recovery sweep failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "marketing-cart-recovery-sweep",
  schedule: "*/15 * * * *",
}
