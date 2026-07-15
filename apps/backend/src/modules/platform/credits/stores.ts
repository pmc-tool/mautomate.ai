import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../index"
import { loadRateOverrides } from "../pricing/price-book"
import type { Reservation, WalletState, WalletStore } from "./ledger"

/**
 * MemoryWalletStore — the reference implementation + test double. atomicReserve
 * is a synchronous check-and-decrement (JS is single-threaded, so this models
 * the DB's atomic conditional UPDATE exactly: two reserves can never both pass
 * the balance guard).
 */
export class MemoryWalletStore implements WalletStore {
  private wallets = new Map<string, WalletState>()
  private reservations = new Map<string, Reservation>()
  private idem = new Set<string>()
  readonly txs: any[] = []

  constructor(seed: Record<string, number> = {}) {
    for (const [t, balance] of Object.entries(seed)) {
      this.wallets.set(t, { balance, reserved: 0 })
    }
  }

  async ensureWallet(tenantId: string): Promise<void> {
    if (!this.wallets.has(tenantId)) {
      this.wallets.set(tenantId, { balance: 0, reserved: 0 })
    }
  }
  async getWallet(tenantId: string): Promise<WalletState> {
    return { ...(this.wallets.get(tenantId) ?? { balance: 0, reserved: 0 }) }
  }
  async atomicReserve(tenantId: string, amount: number): Promise<boolean> {
    const w = this.wallets.get(tenantId) ?? { balance: 0, reserved: 0 }
    if (w.balance < amount) return false
    w.balance -= amount
    w.reserved += amount
    this.wallets.set(tenantId, w)
    return true
  }
  async applyDelta(
    tenantId: string,
    balanceDelta: number,
    reservedDelta: number
  ): Promise<void> {
    const w = this.wallets.get(tenantId) ?? { balance: 0, reserved: 0 }
    w.balance += balanceDelta
    w.reserved += reservedDelta
    this.wallets.set(tenantId, w)
  }
  async saveReservation(r: Reservation): Promise<void> {
    this.reservations.set(r.id, { ...r })
  }
  async getReservation(id: string): Promise<Reservation | undefined> {
    const r = this.reservations.get(id)
    return r ? { ...r } : undefined
  }
  async listOpenReservations(): Promise<Reservation[]> {
    return [...this.reservations.values()].filter((r) => r.status === "open")
  }
  async seenIdempotencyKey(tenantId: string, key: string): Promise<boolean> {
    return this.idem.has(`${tenantId}:${key}`)
  }
  async recordIdempotencyKey(tenantId: string, key: string): Promise<void> {
    this.idem.add(`${tenantId}:${key}`)
  }
  async appendTx(row: any): Promise<void> {
    this.txs.push(row)
  }
}

/**
 * SqlWalletStore — production adapter. The atomic reserve + additive delta run
 * as raw SQL through the platform module (see PlatformModuleService.reserve-
 * CreditsAtomic / applyWalletDelta); reservations, idempotency and the ledger
 * use the module CRUD. The concurrent-burn load test across replicas is the
 * Phase 4 exit gate for this path.
 */
/** Rate-cache freshness, module-scoped: console rate edits must reach EVERY
 *  charge path within a minute, not only those behind the metering guard. */
let ratesLoadedAt = 0

export class SqlWalletStore implements WalletStore {
  constructor(private readonly container: MedusaContainer) {}

  async refreshRates(): Promise<void> {
    const now = Date.now()
    if (now - ratesLoadedAt < 60_000) return
    try {
      const rows = await this.svc().listPriceBookEntries({}, { take: 100 })
      loadRateOverrides(rows || [])
      ratesLoadedAt = now
    } catch {
      /* keep prior overrides / code defaults — never block a charge on this */
    }
  }

  async createLot(row: {
    tenant_id: string
    source: string
    amount: number
    expires_at?: Date | null
    meta?: Record<string, unknown> | null
  }): Promise<void> {
    await this.svc().createCreditLots([
      {
        tenant_id: row.tenant_id,
        source: row.source,
        amount: row.amount,
        remaining: row.amount,
        expires_at: row.expires_at ?? null,
        meta: row.meta ?? null,
      },
    ])
  }

  /** Open lots, SOONEST-EXPIRING first; never-expiring (purchased) lots last. */
  async listOpenLots(
    tenantId: string
  ): Promise<{ id: string; remaining: number; expires_at: Date | null; source: string }[]> {
    const rows = await this.svc().listCreditLots(
      { tenant_id: tenantId, remaining: { $gt: 0 } },
      { take: 500 }
    )
    return (rows ?? [])
      .map((r: any) => ({
        id: r.id,
        remaining: Number(r.remaining ?? 0),
        expires_at: r.expires_at ? new Date(r.expires_at) : null,
        source: r.source,
      }))
      .sort((a: any, b: any) => {
        if (a.expires_at && b.expires_at) return a.expires_at.getTime() - b.expires_at.getTime()
        if (a.expires_at) return -1 // expiring first
        if (b.expires_at) return 1
        return 0
      })
  }

  async setLotRemaining(id: string, remaining: number): Promise<void> {
    await this.svc().updateCreditLots({ id, remaining })
  }

  async listExpiredLots(
    nowMs: number
  ): Promise<{ id: string; tenant_id: string; remaining: number; source: string }[]> {
    const rows = await this.svc().listCreditLots(
      { remaining: { $gt: 0 }, expires_at: { $lt: new Date(nowMs) } },
      { take: 1000 }
    )
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      remaining: Number(r.remaining ?? 0),
      source: r.source,
    }))
  }

  async recordUsage(row: {
    tenant_id: string
    action: string
    units: number
    credits: number
    reservation_id?: string | null
    vendor_cost_usd?: number | null
    meta?: Record<string, unknown> | null
  }): Promise<void> {
    try {
      await this.svc().createUsageEvents([
        {
          tenant_id: row.tenant_id,
          action: row.action,
          units: row.units,
          credits: row.credits,
          reservation_id: row.reservation_id ?? null,
          vendor_cost_usd: row.vendor_cost_usd ?? null,
          meta: row.meta ?? null,
        },
      ])
    } catch {
      /* analytics must never fail a charge */
    }
  }
  private svc(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }
  /** the shared knex/pg connection — for the atomic raw-SQL wallet mutations */
  private pg(): any {
    return this.container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  }

  async ensureWallet(tenantId: string): Promise<void> {
    const svc = this.svc()
    const existing = await svc.listCreditWallets({ tenant_id: tenantId }, { take: 1 })
    if (!existing?.length) {
      await svc.createCreditWallets([{ tenant_id: tenantId, balance: 0, reserved: 0 }])
    }
  }
  async getWallet(tenantId: string): Promise<WalletState> {
    const svc = this.svc()
    const [w] = await svc.listCreditWallets({ tenant_id: tenantId }, { take: 1 })
    return {
      balance: Number(w?.balance ?? 0),
      reserved: Number(w?.reserved ?? 0),
    }
  }
  async atomicReserve(tenantId: string, amount: number): Promise<boolean> {
    // ATOMIC conditional decrement via raw SQL on the shared pg connection.
    // Two concurrent reserves can never both pass the `balance >= amount` guard
    // because the UPDATE is a single atomic statement in Postgres.
    const res = await this.pg().raw(
      `UPDATE credit_wallet
          SET balance = balance - ?, reserved = reserved + ?
        WHERE tenant_id = ? AND deleted_at IS NULL AND balance >= ?
        RETURNING id`,
      [amount, amount, tenantId, amount]
    )
    const rowCount = res?.rowCount ?? res?.rows?.length ?? 0
    return rowCount > 0
  }
  async applyDelta(
    tenantId: string,
    balanceDelta: number,
    reservedDelta: number
  ): Promise<void> {
    await this.pg().raw(
      `UPDATE credit_wallet
          SET balance = balance + ?, reserved = reserved + ?
        WHERE tenant_id = ? AND deleted_at IS NULL`,
      [balanceDelta, reservedDelta, tenantId]
    )
  }
  async saveReservation(r: Reservation): Promise<void> {
    const svc = this.svc()
    const [existing] = await svc.listCreditReservations({ id: r.id }, { take: 1 })
    if (existing) {
      await svc.updateCreditReservations({ id: r.id, status: r.status })
    } else {
      await svc.createCreditReservations([
        { id: r.id, tenant_id: r.tenant_id, amount: r.amount, action: r.action, status: r.status },
      ])
    }
  }
  async getReservation(id: string): Promise<Reservation | undefined> {
    const [row] = await this.svc().listCreditReservations({ id }, { take: 1 })
    if (!row) return undefined
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      amount: Number(row.amount),
      action: row.action ?? "",
      created_ms: row.created_at ? new Date(row.created_at).getTime() : 0,
      status: row.status,
    }
  }
  async listOpenReservations(): Promise<Reservation[]> {
    const rows = await this.svc().listCreditReservations({ status: "open" })
    return (rows ?? []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      amount: Number(row.amount),
      action: row.action ?? "",
      created_ms: row.created_at ? new Date(row.created_at).getTime() : 0,
      status: row.status,
    }))
  }
  async seenIdempotencyKey(tenantId: string, key: string): Promise<boolean> {
    const rows = await this.svc().listCreditTransactions(
      { tenant_id: tenantId, idempotency_key: key },
      { take: 1 }
    )
    return !!rows?.length
  }
  async recordIdempotencyKey(): Promise<void> {
    // enforced by the unique (tenant_id, idempotency_key) index on appendTx
  }
  async appendTx(row: any): Promise<void> {
    await this.svc().createCreditTransactions([row])
  }
}
