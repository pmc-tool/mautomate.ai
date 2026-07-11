import { DialGate } from "../modules/call-center/dialing/dial-gate"
import { ConsentService } from "../modules/call-center/consent/consent-service"

const TENANT = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const OTHER_TENANT = "ten_01KX1H0B92NY38KBJCB0ZRSPQR" // dearwish2
const DNC_NUMBER = "+61400000001"
const OK_NUMBER = "+61400000002"

// Force the call-window wide open so the test is deterministic regardless of the
// wall clock; we are exercising the CONSENT/DNC + concurrency logic here.
const WINDOW_OPEN = { startHour: 0, endHour: 24, tz: "Asia/Dhaka" }

export default async function verifyP5Gate({ container }: any) {
  const consent = new ConsentService(container)
  const gate = new DialGate(container)

  // Seed: DNC the first number (transactional grant is irrelevant — DNC blocks
  // every purpose); grant the second number for marketing.
  await consent.addDnc(TENANT, DNC_NUMBER, { reason: "p5 verify" } as any)
  await consent.recordConsent(TENANT, OK_NUMBER, "marketing", "granted", {
    source: "p5 verify",
  } as any)

  const results: Record<string, unknown> = {}

  // 1. DNC number -> HARD skip (ok:false, reason consent_denied, deferred:false).
  const dnc = await gate.canDial(TENANT, DNC_NUMBER, "transactional", {
    cap: 5,
    ...WINDOW_OPEN,
  })
  results.dnc_number = dnc

  // 2. Granted number -> allowed (ok:true) for marketing.
  const okMarketing = await gate.canDial(TENANT, OK_NUMBER, "marketing", {
    cap: 5,
    ...WINDOW_OPEN,
  })
  results.granted_marketing = okMarketing

  // 3. A number with NO marketing grant -> denied for marketing (opt-in required),
  //    but allowed for transactional (no DNC).
  const noGrantMarketing = await gate.canDial(
    TENANT,
    "+61400000003",
    "marketing",
    { cap: 5, ...WINDOW_OPEN }
  )
  results.ungranted_marketing = noGrantMarketing
  const noGrantTransactional = await gate.canDial(
    TENANT,
    "+61400000003",
    "transactional",
    { cap: 5, ...WINDOW_OPEN }
  )
  results.ungranted_transactional = noGrantTransactional

  // 4. Concurrency cap 0 -> deferral (concurrency_cap_reached).
  const capped = await gate.canDial(TENANT, OK_NUMBER, "transactional", {
    cap: 0,
    ...WINDOW_OPEN,
  })
  results.cap_zero = capped

  // 5. CROSS-TENANT: the DNC we set for TENANT must NOT leak to OTHER_TENANT.
  //    From the other tenant's view, DNC_NUMBER has no DNC row -> transactional OK.
  const crossTenant = await gate.canDial(
    OTHER_TENANT,
    DNC_NUMBER,
    "transactional",
    { cap: 5, ...WINDOW_OPEN }
  )
  results.cross_tenant_dnc_isolation = crossTenant

  // Assertions.
  const checks: [string, boolean][] = [
    ["DNC is hard-skip", dnc.ok === false && dnc.reason === "consent_denied" && dnc.deferred === false],
    ["granted marketing allowed", okMarketing.ok === true],
    ["ungranted marketing denied", noGrantMarketing.ok === false && noGrantMarketing.reason === "consent_denied"],
    ["ungranted transactional allowed", noGrantTransactional.ok === true],
    ["cap 0 deferral", capped.ok === false && capped.reason === "concurrency_cap_reached" && capped.deferred === true],
    ["tenant A DNC does NOT block tenant B", crossTenant.ok === true],
  ]

  console.log("[p5-verify] results:", JSON.stringify(results, null, 2))
  let pass = true
  for (const [name, cond] of checks) {
    console.log(`[p5-verify] ${cond ? "PASS" : "FAIL"} — ${name}`)
    if (!cond) pass = false
  }

  // Cleanup the consent rows we created.
  await consent.removeDnc(TENANT, DNC_NUMBER).catch(() => {})
  await consent
    .recordConsent(TENANT, OK_NUMBER, "marketing", "revoked", {
      source: "p5 verify cleanup",
    } as any)
    .catch(() => {})

  console.log(`[p5-verify] OVERALL ${pass ? "PASS" : "FAIL"}`)
}
