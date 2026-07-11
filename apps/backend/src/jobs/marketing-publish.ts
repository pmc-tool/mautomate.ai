import type { MedusaContainer } from "@medusajs/framework/types"

import { runPublishSweep } from "../modules/marketing/publish/runner"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * marketing-publish (scheduled sweep, every minute).
 *
 * Drives the claim-first publish engine for every active tenant: finds due post
 * targets (scheduled and due, or failed and ready for retry), claims each,
 * publishes via the platform adapter, and reconciles parent post status. The
 * runner owns the two kill switches (MARKETING_ENABLED + durable
 * publishing-halted) and returns zeros when gated, so this job is inert until
 * publishing is explicitly enabled.
 *
 * NEVER throws out of the job — a failure is logged and the next minute retries.
 */
export default async function marketingPublishJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const summary = await runForEachTenant(
      container,
      "publish sweep",
      runPublishSweep
    )
    if (summary.claimed > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[marketing] publish sweep: claimed=${summary.claimed} published=${summary.published} failed=${summary.failed} skipped=${summary.skipped}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[marketing] publish sweep failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "marketing-publish-sweep",
  schedule: "* * * * *",
}
