import {
  COD_CANCEL_REUSE_THRESHOLD,
  HIGH_VALUE_THRESHOLD,
  scoreOrderRisk,
  shouldHoldForConfirmation,
} from "../fulfillment/risk"

describe("call-center/fulfillment/risk", () => {
  describe("scoreOrderRisk", () => {
    it("returns low band for a normal order with no signals", () => {
      const result = scoreOrderRisk({
        order: { id: "order_1", total: 1000, phone: "+8801700000000" },
      })

      expect(result.band).toBe("low")
      expect(result.score).toBe(0)
      expect(result.reasons).toEqual(["No risk signals matched"])
      expect(shouldHoldForConfirmation(result.band)).toBe(false)
    })

    it("returns medium band for a high-value first-time buyer", () => {
      const result = scoreOrderRisk({
        order: { id: "order_2", total: HIGH_VALUE_THRESHOLD },
        isFirstTimeCustomer: true,
      })

      expect(result.band).toBe("medium")
      expect(result.score).toBe(40)
      expect(result.reasons.join(" ")).toContain("first-time customer")
      expect(shouldHoldForConfirmation(result.band)).toBe(true)
    })

    it("does not flag a high-value order from a returning customer", () => {
      const result = scoreOrderRisk({
        order: { id: "order_3", total: HIGH_VALUE_THRESHOLD * 2 },
        isFirstTimeCustomer: false,
      })

      expect(result.band).toBe("low")
      expect(result.score).toBe(0)
    })

    it("does not flag a low-value first-time buyer", () => {
      const result = scoreOrderRisk({
        order: { id: "order_4", total: HIGH_VALUE_THRESHOLD - 1 },
        isFirstTimeCustomer: true,
      })

      expect(result.band).toBe("low")
      expect(result.score).toBe(0)
    })

    it("returns hard band when the shipping address is blocklisted", () => {
      const result = scoreOrderRisk({
        order: { id: "order_5", total: 500 },
        addressBlocklisted: true,
      })

      expect(result.band).toBe("hard")
      expect(result.score).toBe(100)
      expect(result.reasons.join(" ")).toContain("blocklist")
      expect(shouldHoldForConfirmation(result.band)).toBe(true)
    })

    it("returns hard band (hold) when the phone is reused across cancelled COD orders", () => {
      const result = scoreOrderRisk({
        order: { id: "order_6", total: 500 },
        priorCancelCount: COD_CANCEL_REUSE_THRESHOLD,
      })

      expect(result.band).toBe("hard")
      expect(result.score).toBe(80)
      expect(result.reasons.join(" ")).toContain("recently-cancelled COD orders")
      expect(shouldHoldForConfirmation(result.band)).toBe(true)
    })

    it("does not trigger phone-reuse below the threshold", () => {
      const result = scoreOrderRisk({
        order: { id: "order_7", total: 500 },
        priorCancelCount: COD_CANCEL_REUSE_THRESHOLD - 1,
      })

      expect(result.band).toBe("low")
      expect(result.score).toBe(0)
    })

    it("prefers the explicit total override over order.total", () => {
      const result = scoreOrderRisk({
        order: { id: "order_8", total: 10 },
        total: HIGH_VALUE_THRESHOLD,
        isFirstTimeCustomer: true,
      })

      expect(result.band).toBe("medium")
    })

    it("sums additive signals into the highest triggered band", () => {
      const result = scoreOrderRisk({
        order: { id: "order_9", total: HIGH_VALUE_THRESHOLD },
        isFirstTimeCustomer: true,
        addressBlocklisted: true,
        priorCancelCount: COD_CANCEL_REUSE_THRESHOLD,
      })

      expect(result.score).toBe(100 + 80 + 40)
      expect(result.band).toBe("hard")
      expect(result.reasons.length).toBe(3)
    })

    it("treats missing/null totals as zero", () => {
      const result = scoreOrderRisk({
        order: { id: "order_10", total: null },
        isFirstTimeCustomer: true,
      })

      expect(result.band).toBe("low")
      expect(result.score).toBe(0)
    })
  })

  describe("shouldHoldForConfirmation", () => {
    it("holds medium and hard, releases low", () => {
      expect(shouldHoldForConfirmation("low")).toBe(false)
      expect(shouldHoldForConfirmation("medium")).toBe(true)
      expect(shouldHoldForConfirmation("hard")).toBe(true)
    })
  })
})
