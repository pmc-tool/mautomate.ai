import { planErasure } from "../compliance/dsar"
import { SUBPROCESSORS, subprocessorSchedule } from "../compliance/subprocessors"

describe("sub-processor registry", () => {
  it("lists the vendors the platform integrates", () => {
    const names = SUBPROCESSORS.map((s) => s.name)
    expect(names).toEqual(
      expect.arrayContaining(["Cloudflare", "Stripe", "OpenAI", "Deepgram", "Twilio"])
    )
  })
  it("renders a DPA schedule line per vendor", () => {
    expect(subprocessorSchedule().split("\n").length).toBe(SUBPROCESSORS.length)
  })
})

describe("DSAR erasure plan (GDPR Art. 17)", () => {
  const plan = planErasure("ten_a")

  it("covers local stores AND sub-processor propagation", () => {
    expect(plan.some((t) => t.kind === "local" && t.target === "tenant_config")).toBe(true)
    expect(plan.some((t) => t.kind === "subprocessor")).toBe(true)
  })
  it("propagates deletion to recording/AI sub-processors", () => {
    const subs = plan.filter((t) => t.kind === "subprocessor").map((t) => t.target)
    expect(subs).toEqual(expect.arrayContaining(["Deepgram", "ElevenLabs", "OpenAI"]))
  })
  it("retains the audit log for legal basis (not deleted)", () => {
    const audit = plan.find((t) => t.target === "audit_log")
    expect(audit?.action).toMatch(/retain/)
  })
  it("destroys the tenant's DEK and instance", () => {
    expect(plan.some((t) => t.target === "tenant_key")).toBe(true)
    expect(plan.some((t) => t.target === "tenant_instance")).toBe(true)
  })
})
