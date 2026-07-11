import { CreditLedgerService } from "../credits/ledger"
import { MemoryWalletStore } from "../credits/stores"
import {
  creditsFor,
  marginFor,
  TIERS,
  worstCaseMargin,
  PRICE_BOOK,
} from "../pricing/price-book"

describe("price book", () => {
  it("charges the plan §06 rates, rounded to 0.1 credit", () => {
    expect(creditsFor("ai_call_minute", 1)).toBe(20)
    expect(creditsFor("ai_call_minute", 3)).toBe(60)
    expect(creditsFor("sms_segment", 2)).toBe(12)
    expect(creditsFor("email", 1)).toBe(0.2)
    expect(creditsFor("ai_image", 1)).toBe(10)
  })
  it("holds a positive margin on every action", () => {
    for (const a of Object.keys(PRICE_BOOK) as (keyof typeof PRICE_BOOK)[]) {
      expect(marginFor(a)).toBeGreaterThan(1)
    }
  })
  it("every PAID tier has a positive worst-case contribution margin", () => {
    for (const t of TIERS.filter((t) => t.price_usd > 0)) {
      expect(worstCaseMargin(t)).toBeGreaterThan(0)
    }
  })
})

describe("CreditLedgerService — money safety", () => {
  it("reserves atomically and blocks overdraft at zero balance", async () => {
    const store = new MemoryWalletStore({ ten_a: 50 })
    const ledger = new CreditLedgerService(store)
    const ok = await ledger.reserve("ten_a", "ai_call_minute", 1, {
      reservationId: "r1",
    }) // 20 credits
    expect(ok.ok).toBe(true)
    expect((await ledger.balance("ten_a")).balance).toBe(30)
    const fail = await ledger.reserve("ten_a", "ai_call_minute", 2, {
      reservationId: "r2",
    }) // needs 40, only 30 left
    expect(fail.ok).toBe(false)
    if (!fail.ok) expect(fail.reason).toBe("insufficient_credits")
  })

  it("N concurrent reserves never spend past the balance (no double-spend)", async () => {
    const store = new MemoryWalletStore({ ten_a: 100 }) // 5 x 20-credit calls fit
    const ledger = new CreditLedgerService(store)
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        ledger.reserve("ten_a", "ai_call_minute", 1, { reservationId: `r${i}` })
      )
    )
    const granted = results.filter((r) => r.ok).length
    expect(granted).toBe(5) // exactly balance/price, never more
    expect((await ledger.balance("ten_a")).balance).toBe(0)
  })

  it("commit with fewer actual units refunds the remainder", async () => {
    const store = new MemoryWalletStore({ ten_a: 200 })
    const ledger = new CreditLedgerService(store)
    await ledger.reserve("ten_a", "ai_call_minute", 5, { reservationId: "r1" }) // reserve 100
    expect((await ledger.balance("ten_a")).balance).toBe(100)
    const res = await ledger.commit("r1", 2) // actually 2 min = 40
    expect(res.committed).toBe(40)
    expect(res.refunded).toBe(60)
    const w = await ledger.balance("ten_a")
    expect(w.balance).toBe(160) // 100 left + 60 refunded
    expect(w.reserved).toBe(0)
  })

  it("commit is idempotent on the idempotency key", async () => {
    const store = new MemoryWalletStore({ ten_a: 100 })
    const ledger = new CreditLedgerService(store)
    await ledger.reserve("ten_a", "ai_call_minute", 1, { reservationId: "r1" })
    await ledger.commit("r1", 1, { idempotencyKey: "k1" })
    const balAfter = (await ledger.balance("ten_a")).balance
    await ledger.commit("r1", 1, { idempotencyKey: "k1" }) // duplicate webhook
    expect((await ledger.balance("ten_a")).balance).toBe(balAfter)
  })

  it("release refunds a failed action in full", async () => {
    const store = new MemoryWalletStore({ ten_a: 100 })
    const ledger = new CreditLedgerService(store)
    await ledger.reserve("ten_a", "ai_call_minute", 1, { reservationId: "r1" })
    await ledger.release("r1")
    const w = await ledger.balance("ten_a")
    expect(w.balance).toBe(100)
    expect(w.reserved).toBe(0)
  })

  it("bounded overrun charges the extra (balance may dip)", async () => {
    const store = new MemoryWalletStore({ ten_a: 25 })
    const ledger = new CreditLedgerService(store)
    await ledger.reserve("ten_a", "ai_call_minute", 1, { reservationId: "r1" }) // reserve 20
    const res = await ledger.commit("r1", 2) // actually 40 → overrun 20
    expect(res.overrun).toBe(20)
    expect(res.balance).toBe(25 - 40) // -15 : flagged for suspension
  })

  it("chargeback clawback can go negative and signals suspend", async () => {
    const store = new MemoryWalletStore({ ten_a: 30 })
    const ledger = new CreditLedgerService(store)
    const r = await ledger.clawback("ten_a", 50, { idempotencyKey: "cb1" })
    expect(r.balance).toBe(-20)
    expect(r.suspend).toBe(true)
    // idempotent: replaying the same chargeback does not double-subtract
    const again = await ledger.clawback("ten_a", 50, { idempotencyKey: "cb1" })
    expect(again.balance).toBe(-20)
  })

  it("reaper releases reservations stranded past the TTL", async () => {
    const store = new MemoryWalletStore({ ten_a: 100 })
    const ledger = new CreditLedgerService(store)
    await ledger.reserve("ten_a", "ai_call_minute", 1, {
      reservationId: "r1",
      nowMs: 0,
    })
    expect((await ledger.balance("ten_a")).balance).toBe(80)
    const reaped = await ledger.reapExpired(20 * 60 * 1000) // 20 min later
    expect(reaped).toEqual(["r1"])
    expect((await ledger.balance("ten_a")).balance).toBe(100) // refunded
  })

  it("credit grant is idempotent", async () => {
    const store = new MemoryWalletStore({})
    const ledger = new CreditLedgerService(store)
    await ledger.credit("ten_a", 300, { type: "grant", idempotencyKey: "g1" })
    await ledger.credit("ten_a", 300, { type: "grant", idempotencyKey: "g1" })
    expect((await ledger.balance("ten_a")).balance).toBe(300)
  })
})
