import { PLATFORM_MODULE } from "../modules/platform"
import { getLedger } from "../modules/platform/credits/metering"

/**
 * Concurrent-burn test against REAL Postgres (the code's own Phase-4 exit gate,
 * which had never run outside an in-memory fake). Seeds a wallet with a known
 * balance, then fires N concurrent reserves through the raw atomic SQL
 * (reserveCreditsAtomic). If the `WHERE balance >= amount` guard is truly
 * atomic, EXACTLY floor(balance/price) reserves succeed and the balance never
 * goes negative — proving no double-spend.
 *
 * Run: npx medusa exec ./src/scripts/concurrency-burn-test.ts
 */
export default async function concurrencyBurnTest({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const T = "concurrency_test"
  const BALANCE = 100
  const PRICE = 20 // ai_call_minute = 20 credits/unit
  const FIRES = 12 // 12 concurrent attempts; only 5 (100/20) may pass

  // reset any prior test state
  for (const list of ["listCreditReservations", "listCreditTransactions", "listCreditWallets"]) {
    const rows = await svc[list]({ tenant_id: T })
    if (rows?.length) {
      const del = list.replace("list", "delete")
      await svc[del](rows.map((r: any) => r.id))
    }
  }
  await svc.createCreditWallets([{ tenant_id: T, balance: BALANCE, reserved: 0 }])

  const ledger = getLedger(container)
  const results = await Promise.all(
    Array.from({ length: FIRES }, (_, i) =>
      ledger.reserve(T, "ai_call_minute", 1, { reservationId: `burn_${T}_${i}` })
    )
  )
  const ok = results.filter((r) => r.ok).length
  const [wallet] = await svc.listCreditWallets({ tenant_id: T }, { take: 1 })
  const balance = Number(wallet?.balance ?? -999)
  const reserved = Number(wallet?.reserved ?? -999)

  const expectedOk = Math.floor(BALANCE / PRICE)
  const pass =
    ok === expectedOk && balance === 0 && reserved === BALANCE && balance >= 0

  logger.info(
    `[burn-test] fired=${FIRES} succeeded=${ok} (expected ${expectedOk}) balance=${balance} reserved=${reserved}`
  )
  logger.info(
    `[burn-test] RESULT: ${pass ? "PASS — atomic, no double-spend against real Postgres" : "FAIL — double-spend or overdraft!"}`
  )
}
