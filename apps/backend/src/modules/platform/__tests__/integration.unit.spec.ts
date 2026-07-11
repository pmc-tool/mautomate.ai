import { getTenantSecret, platformEnabled } from "../integration/tenant-config"
import { meterAction } from "../integration/metering-guard"
import {
  deriveTenantWebhookSecret,
  signWebhook,
  verifyWebhook,
} from "../integration/webhook-signature"
import { dkimDnsRecords } from "../integration/email-config"

const fakeContainer = { resolve: () => ({}) } as any

describe("per-tenant config resolution (env fallback when platform disabled)", () => {
  const prevEnabled = process.env.PLATFORM_ENABLED
  const prevKey = process.env.SOME_API_KEY
  afterEach(() => {
    process.env.PLATFORM_ENABLED = prevEnabled
    if (prevKey === undefined) delete process.env.SOME_API_KEY
    else process.env.SOME_API_KEY = prevKey
  })

  it("is disabled by default and falls back to env", async () => {
    delete process.env.PLATFORM_ENABLED
    process.env.SOME_API_KEY = "env-value"
    expect(platformEnabled()).toBe(false)
    const v = await getTenantSecret(fakeContainer, "ten_a", "some_key", "SOME_API_KEY")
    expect(v).toBe("env-value")
  })
})

describe("meterAction guard", () => {
  const prev = process.env.PLATFORM_ENABLED
  afterEach(() => {
    process.env.PLATFORM_ENABLED = prev
  })

  it("is a pure passthrough when the platform is disabled (non-breaking)", async () => {
    delete process.env.PLATFORM_ENABLED
    let ran = false
    const out = await meterAction(fakeContainer, "ten_a", "ai_call_minute", 1, async () => {
      ran = true
      return { result: "did-the-call" }
    })
    expect(ran).toBe(true)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result).toBe("did-the-call")
      expect(out.credits).toBe(0) // not metered when disabled
    }
  })
})

describe("per-tenant webhook signatures", () => {
  const master = "master-secret-abc"

  it("derives distinct secrets per tenant", () => {
    expect(deriveTenantWebhookSecret("ten_a", master)).not.toBe(
      deriveTenantWebhookSecret("ten_b", master)
    )
  })

  it("verifies a signature made with the tenant's derived secret", () => {
    const body = JSON.stringify({ call: "done" })
    const sig = signWebhook("ten_a", body, master)
    expect(verifyWebhook("ten_a", body, sig, master)).toBe(true)
  })

  it("rejects a signature from another tenant or a tampered body", () => {
    const body = JSON.stringify({ call: "done" })
    const sig = signWebhook("ten_a", body, master)
    expect(verifyWebhook("ten_b", body, sig, master)).toBe(false)
    expect(verifyWebhook("ten_a", body + "x", sig, master)).toBe(false)
  })
})

describe("per-domain email DNS", () => {
  it("emits SPF, DKIM and DMARC records for a custom sending domain", () => {
    const recs = dkimDnsRecords("acme.com", "b2d")
    expect(recs.map((r) => r.name)).toEqual([
      "@",
      "b2d._domainkey.acme.com",
      "_dmarc.acme.com",
    ])
    expect(recs[0].value).toMatch(/spf1/)
    expect(recs[2].value).toMatch(/DMARC1/)
  })
})
