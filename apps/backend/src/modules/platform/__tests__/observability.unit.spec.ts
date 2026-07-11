import {
  walletDrift,
  aggregateUsage,
  vendorDrift,
} from "../observability/reconciliation"

describe("wallet reconciliation", () => {
  it("is zero when the balance equals the ledger sum", () => {
    const ledger = [{ amount: 300 }, { amount: -20 }, { amount: -40 }]
    expect(walletDrift(ledger, 240)).toBe(0)
  })
  it("detects drift when the balance disagrees with the ledger", () => {
    const ledger = [{ amount: 300 }, { amount: -20 }]
    expect(walletDrift(ledger, 275)).toBe(-5) // balance 5 too low
  })
})

describe("per-tenant cost aggregation", () => {
  it("rolls usage up by action", () => {
    const agg = aggregateUsage([
      { action: "ai_call_minute", units: 2, credits: 40, vendor_cost_usd: 0.22 },
      { action: "ai_call_minute", units: 1, credits: 20, vendor_cost_usd: 0.11 },
      { action: "sms_segment", units: 5, credits: 30, vendor_cost_usd: 0.15 },
    ])
    expect(agg.ai_call_minute).toEqual({ units: 3, credits: 60, vendor_cost_usd: 0.33 })
    expect(agg.sms_segment.credits).toBe(30)
  })
})

describe("vendor drift", () => {
  it("computes the ratio between invoice and expected cost", () => {
    const rows = [
      { action: "ai_call_minute", units: 10, credits: 200, vendor_cost_usd: 1.1 },
    ]
    const d = vendorDrift(rows, 1.32) // invoice 20% higher
    expect(d.expected).toBeCloseTo(1.1)
    expect(d.drift_ratio).toBeCloseTo(0.2)
  })
})
