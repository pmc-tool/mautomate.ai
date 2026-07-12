import type { MedusaContainer } from "@medusajs/framework/types"

import {
  runAgentTickForTenant,
  type AgentTickSummary,
} from "../modules/marketing/agents/agent-runner"
import { getCurrentTenantId, resolveTenantId } from "../lib/tenant-context"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * marketing-agent-tick (scheduled sweep, every 5 minutes).
 *
 * THE AUTONOMY LOOP. For every active tenant it runs each active marketing agent
 * (kind content|social) whose playbook carries a cadence, resolves the cadence
 * slots that fell due in this tick window (in the cadence's own timezone),
 * generates a brand-grounded post per due slot, and places it:
 *   - playbook.mode "approval" -> post "needs_approval" (merchant review kanban)
 *   - playbook.mode "auto"     -> post "scheduled" with targets scheduled at the
 *                                 slot time, which the EXISTING publish sweep
 *                                 (marketing-publish, every minute) then claims
 *                                 and ships. There is no second publisher.
 *
 * CRON — every 5 minutes, with a 30-minute lookback inside the runner:
 *   Slots have minute granularity, so the runner scans every minute of the
 *   lookback window rather than only "now"; a 5-minute cadence therefore cannot
 *   miss a slot, and the generous lookback means a restart or a briefly-dead
 *   scheduler still catches up on slots it slept through. Overlapping windows are
 *   harmless because dedup is stateless and slot-exact (a slot that already has a
 *   post is skipped), so the same slot can never be generated twice.
 *   A 1-minute cron would work too but would re-scan every agent 5x more often
 *   for no gain; anything slower than the lookback would drop slots.
 *
 * GATED by MARKETING_ENABLED=1, exactly like the publish sweep — inert otherwise.
 *
 * NEVER throws out of the job; per-tenant and per-agent failures are isolated.
 */
export default async function marketingAgentTickJob(
  container: MedusaContainer
): Promise<void> {
  try {
    if (process.env.MARKETING_ENABLED !== "1") {
      return
    }

    const summary = await runForEachTenant<AgentTickSummary>(
      container,
      "agent tick",
      async (c) => {
        const tenantId =
          getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")
        return runAgentTickForTenant(c, tenantId)
      }
    )

    if (summary.generated > 0 || summary.errors > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[marketing] agent tick: agents=${summary.agents ?? 0} slots=${
          summary.slots ?? 0
        } generated=${summary.generated ?? 0} dup=${
          summary.skipped_duplicate ?? 0
        } capped=${summary.skipped_capped ?? 0} no_credits=${
          summary.skipped_no_credits ?? 0
        } errors=${summary.errors ?? 0}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[marketing] agent tick failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "marketing-agent-tick",
  schedule: "*/5 * * * *",
}
