import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../modules/marketing"
import { runAutopilotForTenant } from "../modules/marketing/ads"

/**
 * ads-autopilot (scheduled sweep, hourly at :30 — after the :00 insight sync
 * so decisions see fresh numbers).
 *
 * Runs the autopilot pass for every tenant that switched it on. Inert until
 * MARKETING_ADS_ENABLED=1 (the advertising kill switch); merchants can always
 * trigger a free manual check from the Autopilot page regardless.
 *
 * NEVER throws out of the job.
 */
export default async function adsAutopilotJob(
  container: MedusaContainer
): Promise<void> {
  if (process.env.MARKETING_ADS_ENABLED !== "1") return

  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const flags = await mk.listMarketingSettings(
      { key: "ads_autopilot_enabled" },
      { take: 2000 }
    )
    const tenants = (flags ?? [])
      .filter((f: any) => f.value === "1" || f.value === 1 || f.value === true)
      .map((f: any) => f.tenant_id)

    let fired = 0
    for (const tenantId of tenants) {
      try {
        const summary = await runAutopilotForTenant(mk, container, tenantId)
        fired += summary.fired.length
      } catch {
        /* per-tenant failure must not stop the sweep */
      }
    }
    if (tenants.length > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[ads] autopilot sweep: tenants=${tenants.length} actions=${fired}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[ads] autopilot sweep failed:", e as any)
    } catch {
      /* scheduler must never be disrupted */
    }
  }
}

export const config = {
  name: "ads-autopilot-sweep",
  schedule: "30 * * * *",
}
