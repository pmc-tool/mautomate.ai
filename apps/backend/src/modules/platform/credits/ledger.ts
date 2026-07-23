import {
  BillableAction,
  creditsFor,
  creditsPerUnit,
  vendorCostFor,
} from "../pricing/price-book"

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
  /** Optional: pull operator-edited rates so EVERY charge path sees them. */
  refreshRates?(): Promise<void>
  /** Optional: credit-lot layer (source + expiry). */
  createLot?(row: {
    tenant_id: string
    source: string
    amount: number
    expires_at?: Date | null
    meta?: Record<string, unknown> | null
  }): Promise<void>
  /** Lots with credits left, SOONEST-EXPIRING first (never-expiring last). */
  listOpenLots?(tenantId: string): Promise<
    { id: string; remaining: number; expires_at: Date | null; source: string }[]
  >
  setLotRemaining?(id: string, remaining: number): Promise<void>
  /** Lots past their expiry that still hold credits. */
  listExpiredLots?(nowMs: number): Promise<
    { id: string; tenant_id: string; remaining: number; source: string }[]
  >
  /** Optional: record the billed action — the margin dashboard's data source. */
  recordUsage?(row: {
    tenant_id: string
    action: string
    units: number
    credits: number
    reservation_id?: string | null
    vendor_cost_usd?: number | null
    meta?: Record<string, unknown> | null
  }): Promise<void>
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
    // Operator rate edits must reach EVERY charge path, not just the guard's.
    await this.store.refreshRates?.()
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
    opts: { idempotencyKey?: string; meta?: Record<string, unknown> } = {}
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
    // ONE usage row per billed action, emitted HERE — not by scattered call
    // sites (which wrote the wrong keys and produced dead rows). Units are
    // derived from the credits charged when the caller didn't measure them.
    const act = r.action as BillableAction
    const perUnit = creditsPerUnit(act)
    const units = actualUnits ?? (perUnit > 0 ? actual / perUnit : 1)
    await this.store.recordUsage?.({
      tenant_id: r.tenant_id,
      action: r.action,
      units,
      credits: actual,
      reservation_id: reservationId,
      vendor_cost_usd: vendorCostFor(act, units),
      meta: opts.meta ?? null,
    })
    // Spend the credits that would expire soonest, so the ones the merchant
    // PAID for are always the last to be consumed.
    await this.burnLots(r.tenant_id, actual)
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
      /** Where these credits came from — decides whether they can expire. */
      source?: "plan" | "topup" | "trial" | "grant" | "legacy"
      /** null/undefined = never expires (what PURCHASED credits must be). */
      expiresAt?: Date | null
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
    // Every credit that enters the wallet belongs to a lot, so we always know
    // whether it expires. Purchased (topup) credits carry no expiry — ever.
    const source =
      opts.source ?? (opts.type === "topup" ? "topup" : opts.type === "refund" ? "topup" : "grant")
    await this.store.createLot?.({
      tenant_id: tenantId,
      source,
      amount,
      expires_at: source === "topup" ? null : opts.expiresAt ?? null,
      meta: opts.meta ?? null,
    })
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
  /**
   * Consume `amount` credits from the tenant's lots, SOONEST-EXPIRING FIRST
   * (never-expiring lots last). The wallet balance was already moved by the
   * caller — this keeps the lot allocation consistent with it.
   */
  private async burnLots(tenantId: string, amount: number): Promise<void> {
    if (!this.store.listOpenLots || !this.store.setLotRemaining || amount <= 0) return
    let left = amount
    const lots = await this.store.listOpenLots(tenantId)
    for (const lot of lots) {
      if (left <= 0) break
      const take = Math.min(lot.remaining, left)
      await this.store.setLotRemaining(lot.id, lot.remaining - take)
      left -= take
    }
    // `left > 0` means the wallet went negative (bounded overrun/clawback):
    // there is nothing left to burn, which is correct — the debt sits on the
    // wallet balance, not on a lot.
  }

  /** Balance split by whether it can expire — what the merchant should see. */
  async balanceBreakdown(
    tenantId: string
  ): Promise<{ total: number; expiring: number; permanent: number; next_expiry: Date | null }> {
    const w = await this.store.getWallet(tenantId)
    if (!this.store.listOpenLots) {
      return { total: w.balance, expiring: 0, permanent: w.balance, next_expiry: null }
    }
    const lots = await this.store.listOpenLots(tenantId)
    let expiring = 0
    let permanent = 0
    let next: Date | null = null
    for (const l of lots) {
      if (l.expires_at) {
        expiring += l.remaining
        if (!next || l.expires_at < next) next = l.expires_at
      } else {
        permanent += l.remaining
      }
    }
    return { total: w.balance, expiring, permanent, next_expiry: next }
  }

  /**
   * Expire lots past their date: zero the lot and remove those credits from the
   * wallet. Purchased credits have no expiry date, so they are never touched.
   */
  async expireLots(nowMs: number = Date.now()): Promise<{ tenants: number; credits: number }> {
    if (!this.store.listExpiredLots || !this.store.setLotRemaining) {
      return { tenants: 0, credits: 0 }
    }
    const expired = await this.store.listExpiredLots(nowMs)
    const tenants = new Set<string>()
    let credits = 0
    for (const lot of expired) {
      if (lot.remaining <= 0) continue
      await this.store.setLotRemaining(lot.id, 0)
      await this.store.applyDelta(lot.tenant_id, -lot.remaining, 0)
      const w = await this.store.getWallet(lot.tenant_id)
      await this.store.appendTx({
        tenant_id: lot.tenant_id,
        type: "adjust",
        amount: -lot.remaining,
        balance_after: w.balance,
        meta: { reason: "credit_expiry", lot_id: lot.id, source: lot.source },
      })
      tenants.add(lot.tenant_id)
      credits += lot.remaining
    }
    return { tenants: tenants.size, credits }
  }

  /** Post-paid settlement (voice minutes) — record the usage it represents. */
  async settleUsage(
    tenantId: string,
    action: BillableAction,
    units: number,
    credits: number,
    meta?: Record<string, unknown>
  ): Promise<void> {
    await this.store.recordUsage?.({
      tenant_id: tenantId,
      action,
      units,
      credits,
      reservation_id: null,
      vendor_cost_usd: vendorCostFor(action, units),
      meta: meta ?? null,
    })
  }

  async clawback(
    tenantId: string,
    amount: number,
    opts: {
      idempotencyKey?: string
      // Optional billed action this debit represents. Post-paid usage (voice
      // minutes) passes it so the clawback tx is SELF-DESCRIBING and the billing
      // reports can attribute + label it per feature. A true chargeback/rollback
      // (a reversed payment) passes none — it is not feature usage.
      action?: string
      meta?: Record<string, unknown>
    } = {}
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
    // Keep lots consistent with the balance (voice minutes settle this way).
    await this.burnLots(tenantId, amount)
    const w = await this.store.getWallet(tenantId)
    await this.store.appendTx({
      tenant_id: tenantId,
      type: "clawback",
      amount: -amount,
      balance_after: w.balance,
      idempotency_key: opts.idempotencyKey,
      action: opts.action,
      meta: opts.meta,
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
