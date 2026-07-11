import { BillableAction } from "../pricing/price-book"

/**
 * instance-meter — the per-tenant INSTANCE side of metering.
 *
 * In the instance-per-tenant SaaS, a tenant's Medusa runs as its own process
 * with its own database, but the credit WALLET lives in the control-plane DB.
 * So a tenant instance cannot resolve a local ledger — it meters REMOTELY,
 * calling the control plane's internal meter endpoint over HTTP. Everything it
 * needs is a boot constant injected at provision time:
 *   - TENANT_ID              — which wallet to charge (the instance IS one tenant)
 *   - PLATFORM_CONTROL_URL   — the control plane's base url
 *   - PLATFORM_METER_SECRET  — shared secret authorizing the internal call
 *
 * When those are absent (the control plane itself, or single-tenant Forever
 * Finds) this is a pure PASSTHROUGH — the vendor call just runs, exactly as
 * before. So the same provider code is safe everywhere; metering only "switches
 * on" inside a real tenant instance. No Medusa container is required.
 *
 * Money-safety: fail-CLOSED. If the reservation is denied (zero balance) or the
 * control plane is unreachable, the vendor call is blocked (the AI callers catch
 * this and degrade to a non-AI path) — we never hand out unmetered vendor spend.
 */

export const instanceMeteringActive = (): boolean =>
  !!(
    process.env.TENANT_ID &&
    process.env.PLATFORM_CONTROL_URL &&
    process.env.PLATFORM_METER_SECRET
  )

type MeterOp = "reserve" | "commit" | "release"

async function meterCall(op: MeterOp, payload: Record<string, unknown>): Promise<any> {
  const base = process.env.PLATFORM_CONTROL_URL!.replace(/\/$/, "")
  const res = await fetch(`${base}/platform/internal/meter`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-meter-secret": process.env.PLATFORM_METER_SECRET!,
    },
    body: JSON.stringify({ op, tenant_id: process.env.TENANT_ID, ...payload }),
  })
  if (!res.ok) {
    throw new Error(`[meter] ${op} failed: HTTP ${res.status}`)
  }
  return res.json()
}

let seq = 0
const newReservationId = (): string =>
  `imr_${process.env.TENANT_ID}_${process.pid}_${Date.now().toString(36)}_${++seq}`

/** Thrown when the tenant's wallet can't cover an action. Callers degrade. */
export class InsufficientCreditsError extends Error {
  constructor(public readonly action: BillableAction) {
    super(`insufficient_credits for ${action}`)
    this.name = "InsufficientCreditsError"
  }
}

/**
 * Gate + meter one vendor call against the tenant's control-plane wallet.
 * reserve(estimate) → run() → commit(actual) / release(on throw). Passthrough
 * when instance metering is inactive.
 */
export async function meterInstanceCall<T>(
  action: BillableAction,
  estimateUnits: number,
  run: () => Promise<{ result: T; actualUnits?: number }>
): Promise<T> {
  if (!instanceMeteringActive()) {
    return (await run()).result
  }
  const reservationId = newReservationId()
  const reservation = await meterCall("reserve", {
    action,
    units: estimateUnits,
    reservationId,
  })
  if (!reservation?.ok) {
    throw new InsufficientCreditsError(action)
  }
  try {
    const { result, actualUnits } = await run()
    await meterCall("commit", { reservationId, actualUnits }).catch(() => undefined)
    return result
  } catch (e) {
    await meterCall("release", { reservationId }).catch(() => undefined)
    throw e
  }
}
