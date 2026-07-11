import {
  AggregatableCall,
  avgHandleTime,
  byDay,
  connectRate,
  containmentRate,
  outcomeBreakdown,
  sentimentBreakdown,
  totalCost,
} from "../analytics/aggregate"

describe("call-center/analytics/aggregate", () => {
  describe("outcomeBreakdown", () => {
    it("tallies calls by disposition, bucketing unset as 'unknown'", () => {
      const calls: AggregatableCall[] = [
        { disposition: "confirmed" },
        { disposition: "confirmed" },
        { disposition: "cancelled_by_customer" },
        {},
        { disposition: null },
      ]

      expect(outcomeBreakdown(calls)).toEqual({
        confirmed: 2,
        cancelled_by_customer: 1,
        unknown: 2,
      })
    })

    it("returns an empty object for no calls", () => {
      expect(outcomeBreakdown([])).toEqual({})
    })
  })

  describe("connectRate", () => {
    it("computes connected / attempted", () => {
      const calls: AggregatableCall[] = [
        { status: "completed" }, // attempted + connected
        { status: "in_progress" }, // attempted + connected
        { status: "no_answer" }, // attempted only
        { status: "failed" }, // attempted only
        { status: "queued" }, // not attempted
      ]
      // connected 2 / attempted 4 = 0.5
      expect(connectRate(calls)).toBe(0.5)
    })

    it("returns 0 when nothing was attempted (divide-by-zero guard)", () => {
      expect(connectRate([{ status: "queued" }, {}])).toBe(0)
      expect(connectRate([])).toBe(0)
    })
  })

  describe("containmentRate", () => {
    it("counts only completed calls and treats escalations as not contained", () => {
      const calls: AggregatableCall[] = [
        { status: "completed", disposition: "confirmed" }, // contained
        { status: "completed", disposition: "resolved" }, // contained
        { status: "completed", disposition: "transfer" }, // not contained
        { status: "completed", disposition: "escalated" }, // not contained
        { status: "in_progress", disposition: "confirmed" }, // ignored (not completed)
      ]
      // contained 2 / completed 4 = 0.5
      expect(containmentRate(calls)).toBe(0.5)
    })

    it("is case-insensitive on the disposition", () => {
      const calls: AggregatableCall[] = [
        { status: "completed", disposition: "Transferred" },
        { status: "completed", disposition: "confirmed" },
      ]
      expect(containmentRate(calls)).toBe(0.5)
    })

    it("returns 0 when there are no completed calls (divide-by-zero guard)", () => {
      expect(containmentRate([{ status: "no_answer" }])).toBe(0)
      expect(containmentRate([])).toBe(0)
    })
  })

  describe("avgHandleTime", () => {
    it("averages durations in seconds over calls with both timestamps", () => {
      const calls: AggregatableCall[] = [
        {
          started_at: "2026-01-01T00:00:00Z",
          ended_at: "2026-01-01T00:01:00Z",
        }, // 60s
        {
          started_at: new Date("2026-01-01T00:00:00Z"),
          ended_at: new Date("2026-01-01T00:03:00Z"),
        }, // 180s
      ]
      expect(avgHandleTime(calls)).toBe(120)
    })

    it("skips calls missing a bound or with a negative span", () => {
      const calls: AggregatableCall[] = [
        { started_at: "2026-01-01T00:00:00Z" }, // no end -> skipped
        { ended_at: "2026-01-01T00:00:00Z" }, // no start -> skipped
        {
          started_at: "2026-01-01T00:05:00Z",
          ended_at: "2026-01-01T00:00:00Z",
        }, // negative -> skipped
        {
          started_at: "2026-01-01T00:00:00Z",
          ended_at: "2026-01-01T00:00:30Z",
        }, // 30s
      ]
      expect(avgHandleTime(calls)).toBe(30)
    })

    it("returns 0 when no call has a measurable duration (divide-by-zero guard)", () => {
      expect(avgHandleTime([{}])).toBe(0)
      expect(avgHandleTime([])).toBe(0)
    })
  })

  describe("totalCost", () => {
    it("sums cost_total treating nullish as 0", () => {
      const calls: AggregatableCall[] = [
        { cost_total: 1.5 },
        { cost_total: 2 },
        { cost_total: null },
        {},
      ]
      expect(totalCost(calls)).toBe(3.5)
    })

    it("returns 0 for no calls", () => {
      expect(totalCost([])).toBe(0)
    })
  })

  describe("byDay", () => {
    it("buckets by day with counts and summed cost, sorted ascending", () => {
      const calls: AggregatableCall[] = [
        { started_at: "2026-01-02T10:00:00Z", cost_total: 5 },
        { started_at: "2026-01-01T09:00:00Z", cost_total: 1 },
        { started_at: "2026-01-01T23:00:00Z", cost_total: 2 },
        { started_at: null, cost_total: 100 }, // dropped
      ]

      expect(byDay(calls)).toEqual([
        { date: "2026-01-01", count: 2, cost: 3 },
        { date: "2026-01-02", count: 1, cost: 5 },
      ])
    })

    it("returns an empty array for no placeable calls", () => {
      expect(byDay([{ started_at: null }, {}])).toEqual([])
    })
  })

  describe("sentimentBreakdown", () => {
    it("tallies sentiment, bucketing unset as 'unknown'", () => {
      const calls: AggregatableCall[] = [
        { sentiment: "positive" },
        { sentiment: "positive" },
        { sentiment: "negative" },
        {},
      ]

      expect(sentimentBreakdown(calls)).toEqual({
        positive: 2,
        negative: 1,
        unknown: 1,
      })
    })
  })
})
