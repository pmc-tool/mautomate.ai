import { computeMetrics } from "../observability/metrics"

describe("platform metrics aggregation", () => {
  const tenants = [
    { status: "live", package: "growth", credit_balance: 1200 },
    { status: "live", package: "starter", credit_balance: 300 },
    { status: "past_due", package: "pro", credit_balance: 50 },
    { status: "suspended", package: "growth", credit_balance: 0 },
    { status: "provisioning", package: "free_trial", credit_balance: 300 },
  ]
  const txns = [
    { type: "grant", amount: 300 },
    { type: "topup", amount: 2000 }, // $20 top-up
    { type: "commit", amount: -60 },
    { type: "commit", amount: -20 },
  ]
  const usage = [
    { action: "ai_call_minute", units: 3, credits: 60, vendor_cost_usd: 0.33 },
    { action: "sms_segment", units: 5, credits: 30, vendor_cost_usd: 0.15 },
  ]

  const m = computeMetrics(tenants, txns, usage)

  it("counts stores and breaks down by status + package", () => {
    expect(m.tenants_total).toBe(5)
    expect(m.by_status.live).toBe(2)
    expect(m.by_package.growth).toBe(2)
  })

  it("computes MRR from serviceable (live + past_due) subscriptions only", () => {
    // growth 79 + starter 29 + pro 149 = 257 ; suspended/provisioning excluded
    expect(m.mrr_usd).toBe(257)
  })

  it("computes top-up + total revenue", () => {
    expect(m.topup_revenue_usd).toBe(20) // 2000 credits * $0.01
    expect(m.revenue_total_usd).toBe(277) // 257 + 20
  })

  it("sums credits granted / spent / outstanding", () => {
    expect(m.credits_granted).toBe(2300) // 300 grant + 2000 topup
    expect(m.credits_spent).toBe(80) // |−60| + |−20|
    expect(m.credits_outstanding).toBe(1850) // 1200+300+50+0+300
  })

  it("aggregates usage by action", () => {
    expect(m.usage_by_action.ai_call_minute.credits).toBe(60)
    expect(m.usage_by_action.sms_segment.units).toBe(5)
  })
})
