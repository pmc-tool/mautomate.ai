import { resolveTenantId } from "../../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { OtpService } from "../../../../modules/call-center/otp/otp-service"

/**
 * POST /telephony/otp/send  (UNPREFIXED — escapes /admin + /store auth)
 *
 * Issues an SMS one-time-password for step-up identity verification during an
 * inbound WISMO call. The voice runtime calls this AFTER matching the caller to
 * a customer by caller-ID (a hint, not proof) and BEFORE revealing any order
 * detail.
 *
 * Body: `{ tenant_id, phone }`. Response: `{ sent: true }`.
 *
 * NO-THROW CONTRACT: always HTTP 200. The code is never returned. The response
 * is intentionally uniform so a caller cannot probe whether a number exists.
 * Auth: coarse `x-telephony-secret` middleware gate (see middlewares.ts).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const tenantId =
    (typeof body.tenant_id === "string" && body.tenant_id) ||
    (resolveTenantId("CALL_CENTER_DEFAULT_TENANT"))
  const phone = typeof body.phone === "string" ? body.phone.trim() : ""

  if (!phone) {
    res.status(200).json({ sent: false, error: "phone is required" })
    return
  }

  try {
    const otp = new OtpService(req.scope)
    const out = await otp.send(tenantId, phone)
    res.status(200).json(out)
  } catch (e) {
    // Never leak details; a send failure still degrades gracefully in-band.
    const message = e instanceof Error ? e.message : String(e)
    res.status(200).json({ sent: false, error: message.slice(0, 200) })
  }
}
