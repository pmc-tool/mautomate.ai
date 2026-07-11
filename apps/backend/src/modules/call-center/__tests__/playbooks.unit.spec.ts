import { codConfirmationPlaybook } from "../playbooks/cod-confirmation"
import {
  compileSystemPrompt,
  getPlaybook,
  interpolate,
} from "../playbooks"

describe("call-center/playbooks", () => {
  describe("getPlaybook", () => {
    it("resolves a known playbook id", () => {
      expect(getPlaybook("cod-confirmation")?.id).toBe("cod-confirmation")
      expect(getPlaybook("wismo")?.id).toBe("wismo")
    })

    it("returns null for an unknown id", () => {
      expect(getPlaybook("does-not-exist")).toBeNull()
    })
  })

  describe("interpolate", () => {
    it("replaces merge tokens with data values", () => {
      expect(
        interpolate("Hi {{customer_name}}, order {{display_id}}", {
          customer_name: "Ayesha",
          display_id: 1042,
        })
      ).toBe("Hi Ayesha, order 1042")
    })

    it("collapses missing/null tokens to empty string (never leaks {{token}})", () => {
      const out = interpolate("Hi {{customer_name}}!", { customer_name: null })
      expect(out).toBe("Hi !")
      expect(out).not.toContain("{{")
    })

    it("tolerates whitespace inside the token braces", () => {
      expect(interpolate("{{  customer_name  }}", { customer_name: "Ayesha" })).toBe(
        "Ayesha"
      )
    })
  })

  describe("compileSystemPrompt", () => {
    it("includes the persona, language and tone", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {})
      expect(prompt).toContain(codConfirmationPlaybook.persona.name)
      expect(prompt).toContain(codConfirmationPlaybook.persona.language)
      expect(prompt).toContain(codConfirmationPlaybook.persona.tone)
    })

    it("always injects the strict anti-invention rule", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {})
      expect(prompt).toContain("STRICT ANTI-INVENTION RULE")
      expect(prompt).toContain("NEVER invent")
    })

    it("only surfaces whitelisted merge fields and never leaks unlisted data", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {
        customer_name: "Ayesha",
        // Not on the merge_fields whitelist — must NOT appear in the prompt.
        credit_card: "4111111111111111",
      } as any)

      expect(prompt).toContain("Ayesha")
      expect(prompt).not.toContain("4111111111111111")
      expect(prompt).not.toContain("credit_card")
    })

    it("shows omitted whitelisted fields as (unknown)", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {
        customer_name: "Ayesha",
      })
      // display_id was on the whitelist but not provided.
      expect(prompt).toContain("- display_id: (unknown)")
    })

    it("exposes only the default (first) state's tools and hides destructive ones", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {})
      // Opening state allows getOrder but NOT cancelOrder.
      expect(prompt).toContain("- getOrder:")
      expect(prompt).not.toContain("- cancelOrder:")
    })

    it("exposes cancelOrder only when compiling the cancel state", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {}, "cancel")
      expect(prompt).toContain("- cancelOrder:")
    })

    it("includes the guardrail limits and the disposition set", () => {
      const prompt = compileSystemPrompt(codConfirmationPlaybook, {})
      expect(prompt).toContain(
        `Max turns: ${codConfirmationPlaybook.guardrails.max_turns}`
      )
      expect(prompt).toContain("confirmed_with_changes")
    })
  })
})
