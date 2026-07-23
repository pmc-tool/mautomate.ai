import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../modules/call-center"

/**
 * /telephony/transfer-status  (UNPREFIXED — voice-runtime only, secret-gated
 * by the /telephony middleware)
 *
 * GET  ?transfer_id=…        → { status } — polled by the runtime while it
 *                              holds the caller.
 * POST { transfer_id, status } → runtime-side terminal updates only
 *                              (missed | canceled); merchant-side states are
 *                              owned by the merchant routes.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = String((req.query as any)?.transfer_id ?? "")
  if (!id) return res.status(400).json({ message: "transfer_id required" })
  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await cc.retrieveTransfer(id).catch(() => null)
    if (!row) return res.status(404).json({ message: "not found" })
    res.json({ transfer_id: id, status: row.status })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "failed" })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body ?? {}) as Record<string, unknown>
  const id = String(b.transfer_id ?? "")
  const status = String(b.status ?? "")
  if (!id || !["missed", "canceled"].includes(status)) {
    return res
      .status(400)
      .json({ message: "transfer_id and status (missed|canceled) required" })
  }
  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await cc.retrieveTransfer(id).catch(() => null)
    if (!row) return res.status(404).json({ message: "not found" })
    // Never regress an answered/declined row — the merchant action wins.
    if (row.status === "ringing") {
      await cc.updateTransfers({ id, status })
    }
    res.json({ transfer_id: id, status: row.status === "ringing" ? status : row.status })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "failed" })
  }
}
