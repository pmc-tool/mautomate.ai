import { codConfirmationPlaybook } from "../playbooks/cod-confirmation"
import {
  assertToolCall,
  checkGuardrails,
  defaultGuardrails,
  GuardrailState,
  isToolAllowedInState,
} from "../guardrails"

const freshState = (over: Partial<GuardrailState> = {}): GuardrailState => ({
  turns: 0,
  clarify_count: 0,
  offers_saved: 0,
  ...over,
})

describe("call-center/guardrails", () => {
  describe("checkGuardrails", () => {
    it("passes a fresh conversation state", () => {
      expect(checkGuardrails(freshState())).toEqual({ ok: true })
    })

    it("rejects at/over the turn cap", () => {
      const verdict = checkGuardrails(
        freshState({ turns: defaultGuardrails.max_turns })
      )
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("max_turns_exceeded")
    })

    it("allows the turn just under the cap", () => {
      expect(
        checkGuardrails(freshState({ turns: defaultGuardrails.max_turns - 1 })).ok
      ).toBe(true)
    })

    it("rejects when clarify re-asks exceed the cap", () => {
      const verdict = checkGuardrails(
        freshState({ clarify_count: defaultGuardrails.max_clarify + 1 })
      )
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("max_clarify_exceeded")
    })

    it("allows clarify count exactly at the cap", () => {
      expect(
        checkGuardrails(freshState({ clarify_count: defaultGuardrails.max_clarify }))
          .ok
      ).toBe(true)
    })

    it("allows a single saved offer but rejects a second (one-shot save)", () => {
      expect(checkGuardrails(freshState({ offers_saved: 1 })).ok).toBe(true)

      const verdict = checkGuardrails(freshState({ offers_saved: 2 }))
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("offer_already_saved")
    })

    it("honors a playbook that tightens the limits", () => {
      const tight = { ...defaultGuardrails, max_turns: 3 }
      expect(checkGuardrails(freshState({ turns: 3 }), tight).reason).toBe(
        "max_turns_exceeded"
      )
    })
  })

  describe("isToolAllowedInState", () => {
    it("allows cancelOrder only in the cancel state", () => {
      expect(
        isToolAllowedInState(codConfirmationPlaybook, "cancel", "cancelOrder")
      ).toBe(true)
      expect(
        isToolAllowedInState(
          codConfirmationPlaybook,
          "opening_verify_identity",
          "cancelOrder"
        )
      ).toBe(false)
    })

    it("returns false for an unknown state", () => {
      expect(
        isToolAllowedInState(codConfirmationPlaybook, "no_such_state", "endCall")
      ).toBe(false)
    })

    it("returns false for a tool absent from the state whitelist", () => {
      expect(
        isToolAllowedInState(
          codConfirmationPlaybook,
          "opening_verify_identity",
          "confirmOrder"
        )
      ).toBe(false)
    })
  })

  describe("assertToolCall", () => {
    it("accepts a declared tool allowed in the current state", () => {
      expect(
        assertToolCall(
          codConfirmationPlaybook,
          "opening_verify_identity",
          "getOrder"
        )
      ).toEqual({ ok: true })
    })

    it("rejects a tool not declared by the playbook", () => {
      const verdict = assertToolCall(
        codConfirmationPlaybook,
        "opening_verify_identity",
        "launchMissiles"
      )
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("unknown_tool")
    })

    it("rejects a call in an unknown state", () => {
      const verdict = assertToolCall(
        codConfirmationPlaybook,
        "no_such_state",
        "getOrder"
      )
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("unknown_state")
    })

    it("rejects a declared tool not allowed in the current state", () => {
      // cancelOrder is declared but only allowed in the `cancel` state.
      const verdict = assertToolCall(
        codConfirmationPlaybook,
        "opening_verify_identity",
        "cancelOrder"
      )
      expect(verdict.ok).toBe(false)
      expect(verdict.reason).toBe("tool_not_allowed_in_state")
    })
  })
})
