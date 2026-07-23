import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../modules/platform"
import DomainRoutingService from "../modules/platform/domain-routing"

/**
 * domain-verify-sweep (scheduled, every 5 minutes).
 *
 * Re-checks every PENDING custom domain against Cloudflare so the merchant
 * dashboard flips to verified/SSL-active on its own once the customer's
 * nameserver (or CNAME) change propagates — no manual "Check status" click
 * required. Verified domains are never re-polled, so the sweep costs a couple
 * of API calls only while a connection is actually in progress.
 *
 * NEVER throws out of the job — a failure is logged and the next run retries.
 */
export default async function domainVerifySweepJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const routing = new DomainRoutingService(container)

    const pending = await svc.listTenantDomains(
      { type: "custom", verification_status: "pending" },
      { take: 200 }
    )
    if (!pending?.length) return

    for (const row of pending) {
      try {
        const out = await routing.syncCustomHostname(row.id)
        if (out?.verification_status === "verified") {
          const logger: any = container.resolve("logger")
          logger.info(`[domains] ${row.domain} verified (auto-sweep)`)
        }
      } catch {
        // One bad domain must not stop the rest of the sweep.
      }
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[domains] verify sweep failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "domain-verify-sweep",
  schedule: "*/5 * * * *",
}
