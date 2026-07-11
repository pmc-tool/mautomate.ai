import type { MedusaContainer } from "@medusajs/framework/types"

import { BillableAction } from "../pricing/price-book"
import { CreditLedgerService } from "./ledger"
import { SqlWalletStore } from "./stores"

/**
 * Metering helpers — the pre-check-and-reserve wrapper every AI/comms action
 * calls (Phase 5 wires these into call-center + marketing). `withCredits`
 * reserves an estimate BEFORE the vendor call, runs the action, then commits the
 * measured units (or releases on failure) — so a zero balance blocks the action
 * and a crash never strands credits.
 */
export const getLedger = (container: MedusaContainer): CreditLedgerService =>
  new CreditLedgerService(new SqlWalletStore(container))

export type MeteredOutcome<T> =
  | { ok: true; result: T; credits: number }
  | { ok: false; reason: "insufficient_credits"; credits: number }

let counter = 0
const reservationId = (tenantId: string): string =>
  `cres_${tenantId}_${++counter}_${process.pid}`

/**
 * Gate + meter one action. `run` returns the result and the ACTUAL units used
 * (for commit). On any throw, the reservation is released and the error rethrown.
 */
export async function withCredits<T>(
  ledger: CreditLedgerService,
  tenantId: string,
  action: BillableAction,
  estimateUnits: number,
  run: () => Promise<{ result: T; actualUnits?: number }>,
  opts: { reservationId?: string; idempotencyKey?: string } = {}
): Promise<MeteredOutcome<T>> {
  const rid = opts.reservationId ?? reservationId(tenantId)
  const reservation = await ledger.reserve(tenantId, action, estimateUnits, {
    reservationId: rid,
  })
  if (!reservation.ok) {
    return { ok: false, reason: "insufficient_credits", credits: reservation.credits }
  }
  try {
    const { result, actualUnits } = await run()
    const committed = await ledger.commit(rid, actualUnits, {
      idempotencyKey: opts.idempotencyKey,
    })
    return { ok: true, result, credits: committed.committed }
  } catch (e) {
    await ledger.release(rid)
    throw e
  }
}
