import { BillableAction, creditsFor } from "../pricing/price-book"

/**
 * CreditLedgerService — the money-safe credit wallet (plan §06).
 *
 * Reserve → act → commit/release, over an atomic wallet:
 *   - reserve: an ATOMIC conditional decrement (balance >= amount) so two
 *     concurrent reserves can never both succeed past the balance. This is the
 *     real-time zero-balance gate.
 *   - commit:  finalize measured units — release the unused remainder, or (on a
 *     bounded overrun) charge the extra; balance may dip slightly negative and
 *     the tenant is flagged for suspension.
 *   - release: full refund of a reservation (the action failed).
 *   - grant/topup/refund: add credits.
 *   - clawback: subtract (chargeback) — allowed to go negative → suspend signal.
 * Idempotency keys collapse duplicate webhooks/retries. Reservations have a TTL;
 * the reaper releases stranded ones (crash between reserve and commit).
 *
 * The algorithm is storage-agnostic (WalletStore) so it is fully unit-tested via
 * MemoryWalletStore; SqlWalletStore is the production adapter (raw atomic SQL).
 */

export type WalletState = { balance: number; reserved: number }

export type Reservation = {
  id: string
  tenant_id: string
  amount: number
  action: string
  created_ms: number
  status: "open" | "committed" | "released"
}

export interface WalletStore {
  ensureWallet(tenantId: string): Promise<void>
  getWallet(tenantId: string): Promise<WalletState>
  /** ATOMIC: decrement balance & bump reserved iff balance >= amount. */
  atomicReserve(tenantId: string, amount: number): Promise<boolean>
  /** unguarded add of signed deltas (commit/release/grant/clawback). */
  applyDelta(tenantId: string, balanceDelta: number, reservedDelta: number): Promise<void>
  saveReservation(r: Reservation): Promise<void>
  getReservation(id: string): Promise<Reservation | undefined>
  listOpenReservations(): Promise<Reservation[]>
  /** idempotency: returns true if this key was already applied. */
  seenIdempotencyKey(tenantId: string, key: string): Promise<boolean>
  recordIdempotencyKey(tenantId: string, key: string): Promise<void>
  appendTx(row: {
    tenant_id: string
    type: string
    amount: number
    balance_after: number
    reservation_id?: string
    idempotency_key?: string
    action?: string
    meta?: Record<string, any>
  }): Promise<void>
}

export const RESERVATION_TTL_MS = 15 * 60 * 1000

export type ReserveResult =
  | { ok: true; reservation_id: string; credits: number }
  | { ok: false; reason: "insufficient_credits"; credits: number }

export class CreditLedgerService {
  constructor(private readonly store: WalletStore) {}

  async balance(tenantId: string): Promise<WalletState> {
    return this.store.getWallet(tenantId)
  }

  /** Reserve credits for `units` of `action`. Atomic gate on the balance. */
  async reserve(
    tenantId: string,
    action: BillableAction,
    units: number,
    opts: { reservationId: string; nowMs?: number }
  ): Promise<ReserveResult> {
    await this.store.ensureWallet(tenantId)
    const credits = creditsFor(action, units)
    const ok = await this.store.atomicReserve(tenantId, credits)
    if (!ok) {
      return { ok: false, reason: "insufficient_credits", credits }
    }
    const now = opts.nowMs ?? Date.now()
    await this.store.saveReservation({
      id: opts.reservationId,
      tenant_id: tenantId,
      amount: credits,
      action,
      created_ms: now,
      status: "open",
    })
    const w = await this.store.getWallet(tenantId)
    await this.store.appendTx({
      tenant_id: tenantId,
      type: "reserve",
      amount: -credits,
      balance_after: w.balance,
      reservation_id: opts.reservationId,
      action,
    })
    return { ok: true, reservation_id: opts.reservationId, credits }
  }

  /**
   * Commit a reservation with the actual measured units. Releases the unused
   * remainder, or charges a bounded overrun. Idempotent on reservation state.
   */
  async commit(
    reservationId: string,
    actualUnits?: number,
    opts: { idempotencyKey?: string } = {}
  ): Promise<{ committed: number; refunded: number; overrun: number; balance: number }> {
    const r = await this.store.getReservation(reservationId)
    if (!r) throw new Error(`unknown reservation ${reservationId}`)
    if (r.status !== "open") {
      const w = await this.store.getWallet(r.tenant_id)
      return { committed: 0, refunded: 0, overrun: 0, balance: w.balance }
    }
    if (opts.idempotencyKey) {
      if (await this.store.seenIdempotencyKey(r.tenant_id, opts.idempotencyKey)) {
        const w = await this.store.getWallet(r.tenant_id)
        return { committed: 0, refunded: 0, overrun: 0, balance: w.balance }
      }
      await this.store.recordIdempotencyKey(r.tenant_id, opts.idempotencyKey)
    }

    const actual =
      actualUnits === undefined
        ? r.amount
        : creditsFor(r.action as BillableAction, actualUnits)

    let refunded = 0
    let overrun = 0
    // always clear the reservation hold
    if (actual <= r.amount) {
      refunded = r.amount - actual
      // reserved -= r.amount ; balance += refunded
      await this.store.applyDelta(r.tenant_id, refunded, -r.amount)
    } else {
      overrun = actual - r.amount
      // reserved -= r.amount ; balance -= overrun (may go slightly negative)
      await this.store.applyDelta(r.tenant_id, -overrun, -r.amount)
    }
    await this.store.saveReservation({ ...r, status: "committed" })
    const w = await this.store.getWallet(r.tenant_id)
    await this.store.appendTx({
      tenant_id: r.tenant_id,
      type: "commit",
      amount: -actual,
      balance_after: w.balance,
      reservation_id: reservationId,
      idempotency_key: opts.idempotencyKey,
      action: r.action,
    })
    return { committed: actual, refunded, overrun, balance: w.balance }
  }

  /** Release a reservation in full (the action failed before spending). */
  async release(reservationId: string): Promise<void> {
    const r = await this.store.getReservation(reservationId)
    if (!r || r.status !== "open") return
    await this.store.applyDelta(r.tenant_id, r.amount, -r.amount) // reserved->balance
    await this.store.saveReservation({ ...r, status: "released" })
    const w = await this.store.getWallet(r.tenant_id)
    await this.store.appendTx({
      tenant_id: r.tenant_id,
      type: "release",
      amount: r.amount,
      balance_after: w.balance,
      reservation_id: reservationId,
      action: r.action,
    })
  }

  /** Add credits (grant / topup / refund). Idempotent on key. */
  async credit(
    tenantId: string,
    amount: number,
    opts: {
      type?: "grant" | "topup" | "refund"
      idempotencyKey?: string
      meta?: Record<string, any>
    } = {}
  ): Promise<number> {
    await this.store.ensureWallet(tenantId)
    if (opts.idempotencyKey) {
      if (await this.store.seenIdempotencyKey(tenantId, opts.idempotencyKey)) {
        return (await this.store.getWallet(tenantId)).balance
      }
      await this.store.recordIdempotencyKey(tenantId, opts.idempotencyKey)
    }
    await this.store.applyDelta(tenantId, amount, 0)
    const w = await this.store.getWallet(tenantId)
    await this.store.appendTx({
      tenant_id: tenantId,
      type: opts.type ?? "grant",
      amount,
      balance_after: w.balance,
      idempotency_key: opts.idempotencyKey,
      meta: opts.meta,
    })
    return w.balance
  }

  /**
   * Chargeback clawback — subtract credits already granted from a payment that
   * was reversed. Allowed to drive the balance negative; returns whether the
   * tenant should be suspended. Idempotent on key.
   */
  async clawback(
    tenantId: string,
    amount: number,
    opts: { idempotencyKey?: string } = {}
  ): Promise<{ balance: number; suspend: boolean }> {
    await this.store.ensureWallet(tenantId)
    if (opts.idempotencyKey) {
      if (await this.store.seenIdempotencyKey(tenantId, opts.idempotencyKey)) {
        const w = await this.store.getWallet(tenantId)
        return { balance: w.balance, suspend: w.balance < 0 }
      }
      await this.store.recordIdempotencyKey(tenantId, opts.idempotencyKey)
    }
    await this.store.applyDelta(tenantId, -amount, 0)
    const w = await this.store.getWallet(tenantId)
    await this.store.appendTx({
      tenant_id: tenantId,
      type: "clawback",
      amount: -amount,
      balance_after: w.balance,
      idempotency_key: opts.idempotencyKey,
    })
    return { balance: w.balance, suspend: w.balance < 0 }
  }

  /** Reaper: release reservations left open past the TTL (crash recovery). */
  async reapExpired(
    nowMs: number = Date.now(),
    ttlMs: number = RESERVATION_TTL_MS
  ): Promise<string[]> {
    const open = await this.store.listOpenReservations()
    const expired = open.filter((r) => nowMs - r.created_ms >= ttlMs)
    for (const r of expired) {
      await this.release(r.id)
    }
    return expired.map((r) => r.id)
  }
}

export default CreditLedgerService
