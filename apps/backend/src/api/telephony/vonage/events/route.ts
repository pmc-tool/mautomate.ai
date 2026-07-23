import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { mapVonageStatus, validateVonageJwt } from "../_vonage"
import { isTerminalStatus } from "../../twilio/_twilio"

/**
 * POST /telephony/vonage/events  (UNPREFIXED webhook)
 *
 * Vonage event webhook — call lifecycle updates. Idempotent, out-of-order
 * tolerant (terminal statuses never regress), matched by
 * `provider_call_id = uuid`. Billing stays with the voice-agent's call-ended
 * report; this only reconciles status/duration onto the call row.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!validateVonageJwt(req)) {
    return res.status(403).json({ message: "invalid signature" })
  }

  const b = (req.body ?? {}) as Record<string, any>
  const callUuid = b.uuid ?? ""
  const status = mapVonageStatus(b.status)
  if (!callUuid || !status) {
    return res.status(204).send("")
  }

  try {
    const service: any = req.scope.resolve(CALL_CENTER_MODULE)
    const rows = await service.listCalls(
      { provider_call_id: callUuid },
      { take: 1 }
    )
    const row = Array.isArray(rows) ? rows[0] : null
    if (row && !isTerminalStatus(row.status)) {
      // NOTE: duration is NOT stored here — billing minutes come from the
      // voice-agent's own call-ended report, the single metering source.
      const patch: Record<string, unknown> = { id: row.id, status }
      if (status === "completed" || status === "failed") {
        patch.ended_at = new Date()
      }
      await service.updateCalls(patch)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] vonage event update failed:", e)
  }

  res.status(204).send("")
}
