import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { defaultTenantId, validateTwilioSignature } from "../_twilio"

/**
 * POST /telephony/twilio/recording  (UNPREFIXED webhook — escapes /admin + /store auth)
 *
 * Twilio recording-ready callback: RecordingUrl + CallSid (and RecordingSid,
 * RecordingDuration, etc). We stamp `recording_url` onto the matching Call row.
 * Always returns 204.
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
  const recordingUrl = body.RecordingUrl ?? ""

  try {
    if (callSid && recordingUrl) {
      const service: any = req.scope.resolve(CALL_CENTER_MODULE)
      const tenantId = defaultTenantId()

      const existing = await service.listCalls(
        { provider_call_id: callSid, tenant_id: tenantId },
        { take: 1 }
      )
      const call = existing?.[0]

      if (call) {
        await service.updateCalls({ id: call.id, recording_url: recordingUrl })
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] failed to persist recording callback:", e)
  }

  res.status(204).end()
}
