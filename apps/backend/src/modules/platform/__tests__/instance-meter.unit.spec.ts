import {
  instanceMeteringActive,
  meterInstanceCall,
  InsufficientCreditsError,
} from "../integration/instance-meter"

/**
 * instance-meter — verifies the env-gated passthrough (control plane / FF) and
 * the remote reserve→commit / reserve→release flows against a mocked control
 * plane. The real ledger is covered by credits.unit.spec.ts.
 */
describe("instance-meter", () => {
  const OLD = { ...process.env }
  afterEach(() => {
    process.env = { ...OLD }
    ;(global as any).fetch = undefined
  })

  it("is inactive (passthrough) when the instance env is absent", async () => {
    delete process.env.TENANT_ID
    delete process.env.PLATFORM_CONTROL_URL
    delete process.env.PLATFORM_METER_SECRET
    expect(instanceMeteringActive()).toBe(false)

    let ran = false
    const out = await meterInstanceCall("ai_text", 1, async () => {
      ran = true
      return { result: "hello" }
    })
    expect(ran).toBe(true)
    expect(out).toBe("hello")
  })

  it("reserves then commits when active and funded", async () => {
    process.env.TENANT_ID = "ten_x"
    process.env.PLATFORM_CONTROL_URL = "http://cp"
    process.env.PLATFORM_METER_SECRET = "s3cr3t"
    const calls: any[] = []
    ;(global as any).fetch = async (_url: string, init: any) => {
      const body = JSON.parse(init.body)
      calls.push(body.op)
      return { ok: true, json: async () => ({ ok: true }) }
    }
    const out = await meterInstanceCall("ai_text", 1, async () => ({ result: 42 }))
    expect(out).toBe(42)
    expect(calls).toEqual(["reserve", "commit"])
  })

  it("throws InsufficientCreditsError and never runs when reserve is denied", async () => {
    process.env.TENANT_ID = "ten_x"
    process.env.PLATFORM_CONTROL_URL = "http://cp"
    process.env.PLATFORM_METER_SECRET = "s3cr3t"
    ;(global as any).fetch = async () => ({ ok: true, json: async () => ({ ok: false }) })
    let ran = false
    await expect(
      meterInstanceCall("ai_image", 1, async () => {
        ran = true
        return { result: "x" }
      })
    ).rejects.toBeInstanceOf(InsufficientCreditsError)
    expect(ran).toBe(false)
  })

  it("releases the reservation when the vendor call throws", async () => {
    process.env.TENANT_ID = "ten_x"
    process.env.PLATFORM_CONTROL_URL = "http://cp"
    process.env.PLATFORM_METER_SECRET = "s3cr3t"
    const ops: string[] = []
    ;(global as any).fetch = async (_url: string, init: any) => {
      ops.push(JSON.parse(init.body).op)
      return { ok: true, json: async () => ({ ok: true }) }
    }
    await expect(
      meterInstanceCall("ai_text", 1, async () => {
        throw new Error("vendor boom")
      })
    ).rejects.toThrow("vendor boom")
    expect(ops).toEqual(["reserve", "release"])
  })
})
