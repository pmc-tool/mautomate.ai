/**
 * platform-credit-warnings — proactive merchant billing/credit mail.
 *
 * Daily sweep that emails a merchant BEFORE something breaks:
 *   - low AI-credit balance  → "low_credit"
 *   - trial ending soon       → "trial_ending"
 *
 * This is the superadmin → merchant side of the subscription/AI-credit
 * business. It is fully ADDITIVE and SAFE:
 *   - GATED on PLATFORM_LIFECYCLE_EMAILS === "1" (default OFF → inert).
 *   - Reads only; the one write is a per-tenant dedup timestamp in tenant.meta
 *     so a merchant isn't re-warned every day.
 *   - NEVER throws (whole body wrapped); a failure can't affect billing.
 *
 * Receipts for purchase / renewal / top-up / payment-failed are event-driven
 * (fired from the Stripe webhook) — this job covers the time-based warnings
 * that have no event to hang on.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { notifyMerchant } from "../modules/platform/notify"

const PLATFORM_MODULE = "platform"

const LOW_CREDIT_THRESHOLD = Number(process.env.PLATFORM_LOW_CREDIT_THRESHOLD ?? 50)
const TRIAL_WARN_DAYS = Number(process.env.PLATFORM_TRIAL_WARN_DAYS ?? 3)
const DAY = 86_400_000

const daysBetween = (from: number, to: number) => Math.ceil((to - from) / DAY)
const isoNow = () => new Date().toISOString()
const ageDays = (iso?: string | null): number =>
  iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity

export default async function platformCreditWarningsJob(
  container: MedusaContainer
) {
  const logger: any = container.resolve("logger")
  if (process.env.PLATFORM_LIFECYCLE_EMAILS !== "1") return

  let lowSent = 0
  let trialSent = 0
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const tenants: any[] = await svc.listTenants({})
    if (!Array.isArray(tenants)) return

    for (const t of tenants.slice(0, 2000)) {
      try {
        const status = String(t?.status ?? "")
        if (t?.suspended_at || status === "purged" || status === "suspended") {
          continue
        }
        const meta: Record<string, any> = t?.meta || {}

        // --- Low AI-credit balance ---
        let available: number | null = null
        try {
          const wallets: any[] = await svc.listCreditWallets({ tenant_id: t.id })
          if (Array.isArray(wallets) && wallets.length) {
            const w = wallets[0]
            available = Number(w.balance ?? 0) - Number(w.reserved ?? 0)
          }
        } catch {
          // fall back to the cached balance on the tenant row
          if (t?.credit_balance != null) available = Number(t.credit_balance)
        }

        if (
          available != null &&
          available <= LOW_CREDIT_THRESHOLD &&
          available > 0 &&
          ageDays(meta.low_credit_warned_at) >= 3
        ) {
          const r = await notifyMerchant(container, {
            tenantId: t.id,
            template: "low_credit",
            data: { balance: Math.max(0, Math.floor(available)), threshold: LOW_CREDIT_THRESHOLD },
          })
          if (r.ok) {
            lowSent++
            await touchMeta(svc, t, { low_credit_warned_at: isoNow() })
          }
        }

        // --- Trial ending soon ---
        if (t?.trial_ends_at) {
          const endsMs = new Date(t.trial_ends_at).getTime()
          const left = daysBetween(Date.now(), endsMs)
          if (
            left >= 0 &&
            left <= TRIAL_WARN_DAYS &&
            ageDays(meta.trial_warned_at) >= 2
          ) {
            const r = await notifyMerchant(container, {
              tenantId: t.id,
              template: "trial_ending",
              data: { daysLeft: left },
            })
            if (r.ok) {
              trialSent++
              await touchMeta(svc, t, { trial_warned_at: isoNow() })
            }
          }
        }
      } catch (inner: any) {
        logger?.warn?.(
          `[credit-warnings] tenant ${t?.id} skipped: ${inner?.message ?? inner}`
        )
      }
    }

    if (lowSent || trialSent) {
      logger?.info?.(
        `[credit-warnings] sent ${lowSent} low-credit, ${trialSent} trial-ending`
      )
    }
  } catch (e: any) {
    logger?.error?.(`[credit-warnings] ${e?.message ?? e}`)
  }
}

/** Merge dedup timestamps into tenant.meta without clobbering other keys. */
const touchMeta = async (svc: any, tenant: any, patch: Record<string, any>) => {
  try {
    await svc.updateTenants({
      id: tenant.id,
      meta: { ...(tenant.meta || {}), ...patch },
    })
  } catch {
    // dedup is best-effort; a failed write just means a possible re-warn later.
  }
}

export const config = {
  name: "platform-credit-warnings",
  schedule: "23 9 * * *", // daily 09:23 UTC
}
