import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../index"

/**
 * Reconciliation + cost observability (plan §08 GA + risk register).
 *
 * Two nightly checks, both pure + testable:
 *   - wallet drift: the wallet balance must equal the signed sum of the
 *     append-only ledger. Any drift is a bug or tampering → alert.
 *   - vendor drift: credits charged (at our vendor-cost estimate) vs the real
 *     vendor invoice. Sustained drift means the price book is mispriced.
 */
export type LedgerEntry = { amount: number }

/** Wallet balance should equal the sum of ledger amounts (within epsilon). */
export const walletDrift = (
  ledger: LedgerEntry[],
  walletBalance: number
): number => {
  const sum = ledger.reduce((a, e) => a + e.amount, 0)
  return Math.round((walletBalance - sum) * 1000) / 1000
}

export type UsageRow = {
  action: string
  units: number
  credits: number
  vendor_cost_usd?: number | null
}

export type CostByAction = Record<
  string,
  { units: number; credits: number; vendor_cost_usd: number }
>

/** Aggregate usage into a per-action cost breakdown (per-tenant dashboard). */
export const aggregateUsage = (rows: UsageRow[]): CostByAction => {
  const out: CostByAction = {}
  for (const r of rows) {
    const a = (out[r.action] ??= { units: 0, credits: 0, vendor_cost_usd: 0 })
    a.units += r.units
    a.credits += r.credits
    a.vendor_cost_usd += r.vendor_cost_usd ?? 0
  }
  return out
}

/** Expected vendor cost from usage vs the actual invoice → drift ratio. */
export const vendorDrift = (
  rows: UsageRow[],
  actualInvoiceUsd: number
): { expected: number; actual: number; drift_ratio: number } => {
  const expected = rows.reduce((a, r) => a + (r.vendor_cost_usd ?? 0), 0)
  const drift_ratio = expected > 0 ? (actualInvoiceUsd - expected) / expected : 0
  return { expected, actual: actualInvoiceUsd, drift_ratio }
}

export const DRIFT_TOLERANCE = 0.001

export class ReconciliationService {
  constructor(private readonly container: MedusaContainer) {}
  private svc(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }

  /** Per-tenant wallet reconciliation; returns tenants whose balance drifted. */
  async reconcileWallets(): Promise<Array<{ tenant_id: string; drift: number }>> {
    const svc = this.svc()
    const wallets = await svc.listCreditWallets({})
    const drifted: Array<{ tenant_id: string; drift: number }> = []
    for (const w of wallets ?? []) {
      const ledger = await svc.listCreditTransactions({ tenant_id: w.tenant_id })
      const drift = walletDrift(
        (ledger ?? []).map((t: any) => ({ amount: Number(t.amount) })),
        Number(w.balance)
      )
      if (Math.abs(drift) > DRIFT_TOLERANCE) {
        drifted.push({ tenant_id: w.tenant_id, drift })
      }
    }
    return drifted
  }
}

export default ReconciliationService
