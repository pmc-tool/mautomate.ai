import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getLedger } from "../../../../modules/platform/credits/metering"
import { BillableAction } from "../../../../modules/platform/pricing/price-book"

/**
 * POST /platform/internal/meter — the CONTROL-PLANE side of instance metering.
 *
 * A tenant instance (its wallet lives HERE, in the control-plane DB) calls this
 * to reserve / commit / release credits for one vendor action. Authorized by a
 * shared secret header (instances aren't admin users); the real ledger runs
 * against the control-plane container, so the atomic wallet + reservation rows
 * are the single source of truth.
 *
 *   { op:"reserve", tenant_id, action, units, reservationId }  -> { ok, credits }
 *   { op:"commit",  tenant_id, reservationId, actualUnits? }   -> { committed, balance }
 *   { op:"release", tenant_id, reservationId }                 -> { ok:true }
 *
 * NOTE: reserve and commit arrive as SEPARATE requests, so reservations must be
 * durable — the SqlWalletStore persists them in credit_reservation. Not gated by
 * PLATFORM_ENABLED: reaching this endpoint at all means metering is live.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const secret = process.env.PLATFORM_METER_SECRET
  if (!secret || req.headers["x-platform-meter-secret"] !== secret) {
    return res.status(401).json({ message: "unauthorized" })
  }

  const b = (req.body ?? {}) as any
  const op = String(b.op ?? "")
  const tenantId = String(b.tenant_id ?? "").trim()
  const reservationId = String(b.reservationId ?? "").trim()
  if (!tenantId) return res.status(400).json({ message: "tenant_id required" })

  const ledger = getLedger(req.scope)

  try {
    if (op === "reserve") {
      const action = String(b.action ?? "") as BillableAction
      const units = Number.isFinite(+b.units) ? +b.units : 1
      if (!reservationId) return res.status(400).json({ message: "reservationId required" })
      const r = await ledger.reserve(tenantId, action, units, { reservationId })
      return res.status(200).json(r)
    }
    if (op === "commit") {
      if (!reservationId) return res.status(400).json({ message: "reservationId required" })
      const actualUnits = b.actualUnits === undefined ? undefined : +b.actualUnits
      const r = await ledger.commit(reservationId, actualUnits)
      return res.status(200).json(r)
    }
    if (op === "release") {
      if (!reservationId) return res.status(400).json({ message: "reservationId required" })
      await ledger.release(reservationId)
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ message: `unknown op: ${op}` })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? "meter error" })
  }
}
