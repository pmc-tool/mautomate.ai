import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../modules/marketing"
import { runAdsSyncForTenant } from "../modules/marketing/ads"

/**
 * ads-sync (scheduled sweep, hourly).
 *
 * Refreshes the advertising mirror (ad accounts, campaigns, daily insights)
 * for every tenant with a connected ads_connection. Inert until
 * MARKETING_ADS_ENABLED=1, mirroring the marketing publish sweep's kill
 * switch, so deploying the Advertising panel changes nothing until it is
 * explicitly switched on.
 *
 * NEVER throws out of the job — a failure is logged and the next hour retries.
 */
export default async function adsSyncJob(
  container: MedusaContainer
): Promise<void> {
  if (process.env.MARKETING_ADS_ENABLED !== "1") return

  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const connections = await mk.listAdsConnections(
      { status: "connected" },
      { take: 1000 }
    )
    const tenants = Array.from(
      new Set((connections ?? []).map((c: any) => c.tenant_id))
    )

    let synced = 0
    const errors: string[] = []
    for (const tenantId of tenants) {
      try {
        const summary = await runAdsSyncForTenant(mk, tenantId as string)
        synced += 1
        errors.push(...summary.errors)
      } catch (e: any) {
        errors.push(`tenant(${tenantId}): ${e?.message ?? "sync failed"}`)
      }
    }

    if (tenants.length > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[ads] sync sweep: tenants=${tenants.length} ok=${synced} errors=${errors.length}` +
          (errors.length ? ` first="${errors[0]}"` : "")
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[ads] sync sweep failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "ads-sync-sweep",
  schedule: "0 * * * *",
}
