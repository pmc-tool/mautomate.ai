import type { MedusaContainer } from "@medusajs/framework/types"

import { runSegmentReeval } from "../modules/marketing/segments/segment-service"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * marketing-segment-reeval (scheduled sweep, hourly).
 *
 * Re-evaluates every dynamic (rule-based) segment for every active tenant and
 * materializes the fresh member set. The runner owns the master kill switch
 * (MARKETING_ENABLED) and returns zeros when gated, so this job is inert until
 * the marketing brain is explicitly enabled.
 *
 * NEVER throws out of the job — a failure is logged and the next sweep retries.
 */
export default async function marketingSegmentReevalJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const summary = await runForEachTenant(
      container,
      "segment re-eval",
      runSegmentReeval
    )
    if (summary.evaluated > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[marketing] segment re-eval: evaluated=${summary.evaluated} members=${summary.members}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[marketing] segment re-eval failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "marketing-segment-reeval",
  schedule: "0 * * * *",
}
