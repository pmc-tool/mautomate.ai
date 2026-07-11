import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import {
  defaultTenantId,
  isTerminalStatus,
  mapTwilioStatus,
  validateTwilioSignature,
} from "../_twilio"

/**
 * POST /telephony/twilio/status  (UNPREFIXED webhook — escapes /admin + /store auth)
 *
 * Twilio call-status callback: CallSid + CallStatus (ringing / in-progress /
 * completed / busy / no-answer / failed / canceled). We map it to our Call
 * status and `updateCalls` by `provider_call_id`.
 *
 * IDEMPOTENT / COALESCE-style: callbacks can arrive out of order, so once a call
 * has reached a TERMINAL status we do NOT overwrite it with a later transient
 * one. Always returns 204 (Twilio ignores the body of status callbacks).
 *
 * Auth: coarse `x-telephony-secret` middleware gate + in-handler Twilio
 * signature. RAW-BODY REQUIREMENT: `src/api/middlewares.ts` must give
 * `/telephony/*` a urlencoded/raw body parser (documented for the integrator).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!validateTwilioSignature(req)) {
    res.status(403).end()
    return
  }

  const body = (req.body ?? {}) as Record<string, string | undefined>
  const callSid = body.CallSid ?? ""
  const nextStatus = mapTwilioStatus(body.CallStatus)

  try {
    if (callSid && nextStatus) {
      const service: any = req.scope.resolve(CALL_CENTER_MODULE)
      const tenantId = defaultTenantId()

      const existing = await service.listCalls(
        { provider_call_id: callSid, tenant_id: tenantId },
        { take: 1 }
      )
      const call = existing?.[0]

      if (call && !isTerminalStatus(call.status)) {
        const update: Record<string, unknown> = {
          id: call.id,
          status: nextStatus,
        }
        // Stamp ended_at once we reach a terminal status (and only if unset).
        if (isTerminalStatus(nextStatus) && !call.ended_at) {
          update.ended_at = new Date()
        }
        await service.updateCalls(update)
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] failed to persist call status callback:", e)
  }

  res.status(204).end()
}
