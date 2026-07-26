import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { dailyCapForPlan } from "../modules/platform/entitlements"

/**
 * Finance watchtower (monetization plan P5).
 *
 * Daily visibility + anomaly alerts on credit consumption, from the same
 * append-only ledger the charges flow through:
 *  - yesterday's top credit spenders (with plan + estimated vendor cost)
 *  - alert when any tenant burned >80% of its daily cap (runaway candidates)
 *  - a platform-wide day summary (credits committed, estimated COGS)
 *
 * Everything is logged with the [finance-watchtower] prefix so it is
 * grep-able and can later feed email/Slack without touching this job.
 * (The super-admin margin page remains the interactive view; this is the
 * alarm bell.)
 */
export default async function financeWatchtowerJob(container: MedusaContainer) {
  const logger: any = container.resolve("logger")
  try {
    const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const res = await pg.raw(
      `SELECT ct.tenant_id,
              t.slug,
              t.package,
              -sum(ct.amount)::int AS credits,
              coalesce(sum(u.vendor_cost_usd), 0)::float AS est_cost_usd
         FROM credit_transaction ct
         JOIN tenant t ON t.id = ct.tenant_id
    LEFT JOIN usage_event u
           ON u.tenant_id = ct.tenant_id
          AND u.created_at >= date_trunc('day', now()) - interval '1 day'
          AND u.created_at <  date_trunc('day', now())
        WHERE ct.type = 'commit'
          AND ct.deleted_at IS NULL
          AND ct.created_at >= date_trunc('day', now()) - interval '1 day'
          AND ct.created_at <  date_trunc('day', now())
     GROUP BY 1, 2, 3
     ORDER BY credits DESC`
    )
    const rows: any[] = res?.rows ?? []
    if (!rows.length) {
      return
    }

    const totalCredits = rows.reduce((s, r) => s + Number(r.credits || 0), 0)
    const totalCost = rows.reduce((s, r) => s + Number(r.est_cost_usd || 0), 0)
    logger.info(
      `[finance-watchtower] yesterday: ${totalCredits} credits committed across ${rows.length} tenant(s), est vendor cost $${totalCost.toFixed(2)}`
    )

    for (const r of rows.slice(0, 5)) {
      logger.info(
        `[finance-watchtower] top: ${r.slug} (${r.package}) ${r.credits}cr est $${Number(r.est_cost_usd).toFixed(2)}`
      )
    }

    for (const r of rows) {
      const cap = dailyCapForPlan(r.package)
      if (cap != null && Number(r.credits) >= cap * 0.8) {
        logger.warn(
          `[finance-watchtower] ALERT ${r.slug} (${r.package}) burned ${r.credits}/${cap} daily-cap credits yesterday - runaway or upsell candidate`
        )
      }
    }
  } catch (e: any) {
    const logger2: any = container.resolve("logger")
    logger2.error(`[finance-watchtower] ${e?.message ?? e}`)
  }
}

export const config = {
  name: "finance-watchtower",
  schedule: "7 1 * * *", // daily 01:07
}
