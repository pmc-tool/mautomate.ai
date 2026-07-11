import { CALL_CENTER_MODULE } from "../modules/call-center"

const A = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const B = "ten_01KX1H0B92NY38KBJCB0ZRSPQR" // other tenant
const PHONE = "+61400888999"

export default async function verifyErasure({ container }: any) {
  const cc: any = container.resolve(CALL_CENTER_MODULE)

  // Seed: a call for tenant A with PHONE, plus the SAME phone for tenant B.
  const callA = await cc.createCalls({
    tenant_id: A,
    direction: "inbound",
    status: "completed",
    from_number: PHONE,
    to_number: "+61480000000",
    transcript: { turns: ["secret A"] },
    started_at: new Date(),
  })
  await cc.createDispositions({
    tenant_id: A,
    call_id: callA.id,
    outcome: "answered_question",
    set_by: "test",
  })
  await cc.createConsents({
    tenant_id: A,
    phone: PHONE,
    purpose: "marketing",
    status: "granted",
  })
  const callB = await cc.createCalls({
    tenant_id: B,
    direction: "inbound",
    status: "completed",
    from_number: PHONE,
    to_number: "+61480000001",
    started_at: new Date(),
  })

  // Replicate the erasure route's logic for tenant A only.
  const erase = async (tenant_id: string, phone: string) => {
    const calls: any[] = []
    for (const key of ["from_number", "to_number"]) {
      const rows = await cc.listCalls({ tenant_id, [key]: phone }, { take: 1000 })
      for (const r of rows as any[]) if (!calls.find((c) => c.id === r.id)) calls.push(r)
    }
    for (const call of calls) {
      const disps = await cc.listDispositions(
        { tenant_id, call_id: call.id },
        { take: 1000 }
      )
      if ((disps as any[]).length)
        await cc.deleteDispositions((disps as any[]).map((d) => d.id))
    }
    if (calls.length) await cc.deleteCalls(calls.map((c) => c.id))
    const consents = await cc.listConsents({ tenant_id, phone }, { take: 1000 })
    if ((consents as any[]).length)
      await cc.deleteConsents((consents as any[]).map((c) => c.id))
    return calls.length
  }

  const erased = await erase(A, PHONE)

  // Verify: tenant A's data gone; tenant B's SAME-phone call untouched.
  const aCallsLeft = await cc.listCalls({ tenant_id: A, from_number: PHONE }, { take: 10 })
  const aConsentsLeft = await cc.listConsents({ tenant_id: A, phone: PHONE }, { take: 10 })
  const bCallsLeft = await cc.listCalls({ tenant_id: B, from_number: PHONE }, { take: 10 })

  const checks: [string, boolean][] = [
    ["erased at least the seeded call", erased >= 1],
    ["tenant A calls gone", (aCallsLeft as any[]).length === 0],
    ["tenant A consent gone", (aConsentsLeft as any[]).length === 0],
    ["tenant B call UNTOUCHED (scope)", (bCallsLeft as any[]).length === 1],
  ]
  let pass = true
  for (const [n, c] of checks) {
    console.log(`[erasure] ${c ? "PASS" : "FAIL"} — ${n}`)
    if (!c) pass = false
  }

  // Cleanup tenant B seed.
  await cc.deleteCalls([callB.id]).catch(() => {})
  console.log(`[erasure] OVERALL ${pass ? "PASS" : "FAIL"}`)
}
