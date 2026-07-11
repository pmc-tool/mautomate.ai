import { DialGate } from "../dialing/dial-gate"

/**
 * Only the pure/near-pure methods are exercised here: `withinCallWindow` and
 * `nextRetryAt`. Both are deterministic given an explicit `now`, so no container
 * is needed — the constructor merely stores the reference. `concurrencyOk` and
 * `canDial` need the module container and are intentionally not unit-tested.
 */
describe("call-center/dialing/dial-gate", () => {
  const gate = new DialGate({} as any)

  describe("withinCallWindow", () => {
    it("is inside the default Asia/Dhaka window at the start hour (inclusive)", () => {
      // 2026-01-01T04:00:00Z -> 10:00 in Dhaka (UTC+6).
      const now = new Date("2026-01-01T04:00:00Z")
      expect(gate.withinCallWindow(now)).toBe(true)
    })

    it("is outside just before the start hour", () => {
      // 03:59Z -> 09:59 Dhaka.
      const now = new Date("2026-01-01T03:59:00Z")
      expect(gate.withinCallWindow(now)).toBe(false)
    })

    it("is inside just before the exclusive end hour", () => {
      // 12:59Z -> 18:59 Dhaka.
      const now = new Date("2026-01-01T12:59:00Z")
      expect(gate.withinCallWindow(now)).toBe(true)
    })

    it("is outside at the exclusive end hour", () => {
      // 13:00Z -> 19:00 Dhaka (end is exclusive).
      const now = new Date("2026-01-01T13:00:00Z")
      expect(gate.withinCallWindow(now)).toBe(false)
    })

    it("evaluates the SAME instant differently across timezones", () => {
      // 2026-01-01T04:00:00Z: Dhaka 10:00 (inside), Los Angeles prev-day 20:00 (outside).
      const now = new Date("2026-01-01T04:00:00Z")
      expect(gate.withinCallWindow(now, "Asia/Dhaka")).toBe(true)
      expect(gate.withinCallWindow(now, "America/Los_Angeles")).toBe(false)
    })

    it("normalizes midnight to hour 0 (handles the '24' edge)", () => {
      // 2026-01-01T18:00:00Z -> 00:00 (midnight) in Dhaka.
      const midnight = new Date("2026-01-01T18:00:00Z")
      // Outside the default 10-19 window.
      expect(gate.withinCallWindow(midnight, "Asia/Dhaka")).toBe(false)
      // With a window starting at midnight, hour 0 must be counted as inside
      // (it would be excluded if the hour were treated as 24).
      expect(gate.withinCallWindow(midnight, "Asia/Dhaka", 0, 6)).toBe(true)
    })

    it("respects a custom UTC window", () => {
      expect(gate.withinCallWindow(new Date("2026-01-01T10:00:00Z"), "UTC")).toBe(
        true
      )
      expect(gate.withinCallWindow(new Date("2026-01-01T20:00:00Z"), "UTC")).toBe(
        false
      )
    })

    it("fails closed (false) on an invalid timezone", () => {
      const now = new Date("2026-01-01T04:00:00Z")
      expect(gate.withinCallWindow(now, "Not/AZone")).toBe(false)
    })
  })

  describe("nextRetryAt", () => {
    const now = new Date("2026-01-01T00:00:00Z")

    it("schedules the first retry (attempt 0) +3h", () => {
      expect(gate.nextRetryAt(0, now).toISOString()).toBe(
        "2026-01-01T03:00:00.000Z"
      )
    })

    it("schedules the second retry (attempt 1) +1d", () => {
      expect(gate.nextRetryAt(1, now).toISOString()).toBe(
        "2026-01-02T00:00:00.000Z"
      )
    })

    it("schedules the third retry (attempt 2) +1d", () => {
      expect(gate.nextRetryAt(2, now).toISOString()).toBe(
        "2026-01-02T00:00:00.000Z"
      )
    })

    it("clamps attempts beyond the table to the last (+1d) step", () => {
      expect(gate.nextRetryAt(5, now).toISOString()).toBe(
        "2026-01-02T00:00:00.000Z"
      )
    })

    it("clamps negative attempts to the first (+3h) step", () => {
      expect(gate.nextRetryAt(-3, now).toISOString()).toBe(
        "2026-01-01T03:00:00.000Z"
      )
    })

    it("treats a non-finite attempt as the first step", () => {
      expect(gate.nextRetryAt(NaN, now).toISOString()).toBe(
        "2026-01-01T03:00:00.000Z"
      )
    })
  })
})
