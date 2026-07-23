import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getLedger } from "../../../../modules/platform/credits/metering"
import { SqlWalletStore } from "../../../../modules/platform/credits/stores"
import { BillableAction } from "../../../../modules/platform/pricing/price-book"

/**
 * Timing-safe secret compare — hash both sides to a fixed-length digest so the
 * length never leaks and the comparison is constant-time (mirrors the CMS /
 * telephony gates). Replaces the timing-unsafe `!==`.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

/**
 * SECURITY INVARIANT: a meter op may only settle a reservation that BELONGS to
 * the tenant_id the caller authenticated as. The ledger keys commit/release on
 * the reservation's OWN stored tenant, so without this a secret-holder could
 * commit/release ANOTHER tenant's reservation by id. Returns true when the
 * reservation provably belongs to a different tenant (reject). An unknown
 * reservation is not treated as foreign (the ledger call is a safe no-op on
 * unknown/closed reservations), and a lookup error fails OPEN only for this
 * tenant-match probe so a legitimate settlement is never hard-blocked.
 */
async function reservationBelongsToAnotherTenant(
  req: MedusaRequest,
  tenantId: string,
  reservationId: string
): Promise<boolean> {
  try {
    const store = new SqlWalletStore(req.scope)
    const r = await store.getReservation(reservationId)
    return !!r && r.tenant_id !== tenantId
  } catch {
    return false
  }
}

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
  // SECURITY INVARIANT: timing-safe compare (was a timing-unsafe `!==`). The
  // header is normalised to a string first so an array/undefined value can never
  // coerce past the check. NOTE: this remains a single SHARED secret, so a
  // holder is still trusted for reserve; true per-tenant isolation on reserve
  // needs per-tenant secrets (host.ts "Per-tenant secrets land in Phase 3").
  // The commit/release tenant binding below is the concrete cross-tenant guard.
  const secret = process.env.PLATFORM_METER_SECRET
  const provided = req.headers["x-platform-meter-secret"]
  const providedStr = typeof provided === "string" ? provided : ""
  if (!secret || !providedStr || !safeEqual(providedStr, secret)) {
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
      // Reject settling a reservation owned by a different tenant (cross-tenant).
      if (await reservationBelongsToAnotherTenant(req, tenantId, reservationId)) {
        return res.status(403).json({ message: "reservation does not belong to tenant" })
      }
      const actualUnits = b.actualUnits === undefined ? undefined : +b.actualUnits
      const r = await ledger.commit(reservationId, actualUnits)
      return res.status(200).json(r)
    }
    if (op === "release") {
      if (!reservationId) return res.status(400).json({ message: "reservationId required" })
      // Reject releasing a reservation owned by a different tenant (cross-tenant).
      if (await reservationBelongsToAnotherTenant(req, tenantId, reservationId)) {
        return res.status(403).json({ message: "reservation does not belong to tenant" })
      }
      await ledger.release(reservationId)
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ message: `unknown op: ${op}` })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? "meter error" })
  }
}
