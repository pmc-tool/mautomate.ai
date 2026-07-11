import { CreditLedgerService } from "../credits/ledger"
import { MemoryWalletStore } from "../credits/stores"
import { withCredits } from "../credits/metering"
import {
  isServiceable,
  LifecycleState,
  nextLifecycleState,
} from "../billing/lifecycle"
import {
  gatewayForCountry,
  webhookIdempotencyKey,
} from "../billing/provider"

describe("withCredits metering wrapper", () => {
  it("gates on balance, runs the action, commits actual units", async () => {
    const ledger = new CreditLedgerService(new MemoryWalletStore({ ten_a: 100 }))
    const out = await withCredits(
      ledger,
      "ten_a",
      "ai_call_minute",
      3, // estimate 60 credits
      async () => ({ result: "call-ok", actualUnits: 2 }) // actually 40
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result).toBe("call-ok")
      expect(out.credits).toBe(40)
    }
    expect((await ledger.balance("ten_a")).balance).toBe(60) // 100-40
  })

  it("refuses the action when credits are insufficient", async () => {
    const ledger = new CreditLedgerService(new MemoryWalletStore({ ten_a: 5 }))
    let ran = false
    const out = await withCredits(ledger, "ten_a", "ai_call_minute", 1, async () => {
      ran = true
      return { result: "x" }
    })
    expect(out.ok).toBe(false)
    expect(ran).toBe(false) // never called the vendor
  })

  it("releases the reservation when the action throws", async () => {
    const ledger = new CreditLedgerService(new MemoryWalletStore({ ten_a: 100 }))
    await expect(
      withCredits(ledger, "ten_a", "ai_call_minute", 1, async () => {
        throw new Error("vendor down")
      })
    ).rejects.toThrow("vendor down")
    expect((await ledger.balance("ten_a")).balance).toBe(100) // fully refunded
  })
})

describe("billing lifecycle", () => {
  it("walks the dunning path", () => {
    let s: LifecycleState = "active"
    s = nextLifecycleState(s, "payment_failed")
    expect(s).toBe("past_due")
    s = nextLifecycleState(s, "grace_started")
    expect(s).toBe("grace")
    s = nextLifecycleState(s, "grace_expired")
    expect(s).toBe("suspended")
    s = nextLifecycleState(s, "retention_expired")
    expect(s).toBe("retained")
    s = nextLifecycleState(s, "purge")
    expect(s).toBe("purged")
  })
  it("recovers to active on payment, and purged is terminal", () => {
    expect(nextLifecycleState("suspended", "payment_succeeded")).toBe("active")
    expect(nextLifecycleState("purged", "payment_succeeded")).toBe("purged")
  })
  it("abuse suspends from any live state, distinct from billing", () => {
    expect(nextLifecycleState("active", "abuse_detected")).toBe("suspended")
  })
  it("serviceable only while active or past_due", () => {
    expect(isServiceable("active")).toBe(true)
    expect(isServiceable("past_due")).toBe(true)
    expect(isServiceable("suspended")).toBe(false)
  })
})

describe("gateway routing", () => {
  it("routes BD to SSLCommerz and the rest to Stripe", () => {
    expect(gatewayForCountry("BD").name).toBe("sslcommerz")
    expect(gatewayForCountry("US").name).toBe("stripe")
    expect(gatewayForCountry(undefined).name).toBe("stripe")
  })
  it("builds a composite (provider,event) idempotency key, not global", () => {
    expect(
      webhookIdempotencyKey({ provider: "stripe", external_event_id: "evt_1" })
    ).toBe("stripe:evt_1")
    expect(
      webhookIdempotencyKey({ provider: "sslcommerz", external_event_id: "evt_1" })
    ).not.toBe(
      webhookIdempotencyKey({ provider: "stripe", external_event_id: "evt_1" })
    )
  })
})
