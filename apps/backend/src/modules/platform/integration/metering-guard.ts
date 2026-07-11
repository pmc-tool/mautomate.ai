import type { MedusaContainer } from "@medusajs/framework/types"

import { BillableAction, loadRateOverrides } from "../pricing/price-book"
import { PLATFORM_MODULE } from ".."
import { getLedger, withCredits, MeteredOutcome } from "../credits/metering"
import { platformEnabled } from "./tenant-config"

/**
 * meterAction — the single entry point call-center + marketing use to gate an
 * AI/comms action on credits. When the platform is DISABLED (current single-
 * tenant Forever Finds) it is a pure passthrough: the action just runs, exactly
 * as today. When ENABLED it reserves→acts→commits against the tenant wallet, so
 * a zero balance blocks the vendor call and usage is metered.
 *
 * This keeps the wiring non-breaking: modules call meterAction everywhere, and
 * metering only "switches on" for real multi-tenant instances.
 */
let ratesLoadedAt = 0
/** Refresh the editable rate cache from the DB at most once/min (fail-safe). */
async function refreshRatesIfStale(container: MedusaContainer): Promise<void> {
  const now = Date.now()
  if (now - ratesLoadedAt < 60_000) return
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const rows = await svc.listPriceBookEntries({}, { take: 100 })
    loadRateOverrides(rows || [])
    ratesLoadedAt = now
  } catch {
    // keep prior overrides / code defaults
  }
}

export async function meterAction<T>(
  container: MedusaContainer,
  tenantId: string,
  action: BillableAction,
  estimateUnits: number,
  run: () => Promise<{ result: T; actualUnits?: number }>,
  opts: { idempotencyKey?: string } = {}
): Promise<MeteredOutcome<T>> {
  if (!platformEnabled()) {
    const { result } = await run()
    return { ok: true, result, credits: 0 }
  }
  await refreshRatesIfStale(container)
  const ledger = getLedger(container)
  return withCredits(ledger, tenantId, action, estimateUnits, run, opts)
}

/**
 * A batch pre-check: reserve credits for a whole blast (e.g. 10k emails) up
 * front so it can't half-send into overdraft. Returns the reservation the
 * caller commits per-send / releases the remainder of.
 */
export async function reserveBatch(
  container: MedusaContainer,
  tenantId: string,
  action: BillableAction,
  totalUnits: number,
  reservationId: string
): Promise<{ ok: boolean; credits: number }> {
  if (!platformEnabled()) return { ok: true, credits: 0 }
  await refreshRatesIfStale(container)
  const ledger = getLedger(container)
  const r = await ledger.reserve(tenantId, action, totalUnits, { reservationId })
  return r.ok
    ? { ok: true, credits: r.credits }
    : { ok: false, credits: r.credits }
}
