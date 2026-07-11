import type { MedusaContainer } from "@medusajs/framework/types"

import { runJourneySweep } from "../modules/marketing/journey/runner"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * marketing-journeys (scheduled sweep, every minute).
 *
 * Drives the claim-first journey runner for every active tenant: finds due
 * enrollments, claims each, then steps it through the journey's
 * wait/condition/action nodes. The runner owns both kill switches
 * (MARKETING_ENABLED + durable journeys_halted setting) and returns zeros when
 * gated, so this job is inert until journeys are enabled.
 *
 * NEVER throws out of the job — a failure is logged and the next minute retries.
 */
export default async function marketingJourneysJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const summary = await runForEachTenant(
      container,
      "journey sweep",
      runJourneySweep
    )
    if (summary.processed > 0 || summary.completed > 0 || summary.failed > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[marketing] journey sweep: processed=${summary.processed} completed=${summary.completed} failed=${summary.failed}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[marketing] journey sweep failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "marketing-journey-sweep",
  schedule: "* * * * *",
}
