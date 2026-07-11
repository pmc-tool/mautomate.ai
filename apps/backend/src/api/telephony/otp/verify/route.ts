import { resolveTenantId } from "../../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { OtpService } from "../../../../modules/call-center/otp/otp-service"

/**
 * POST /telephony/otp/verify  (UNPREFIXED — escapes /admin + /store auth)
 *
 * Verifies a caller-supplied SMS code against a pending challenge. The voice
 * runtime calls this during an inbound WISMO call; a `{ verified: true }` result
 * is the ONLY thing that unlocks disclosure of sensitive order detail. A
 * `{ locked: true }` result means the attempt cap was hit — the runtime should
 * stop retrying and escalate to a human.
 *
 * Body: `{ tenant_id, phone, code }`. Response: `{ verified, locked? }`.
 *
 * NO-THROW CONTRACT: always HTTP 200; failures come back as
 * `{ verified: false }`. Auth: coarse `x-telephony-secret` middleware gate.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const tenantId =
    (typeof body.tenant_id === "string" && body.tenant_id) ||
    (resolveTenantId("CALL_CENTER_DEFAULT_TENANT"))
  const phone = typeof body.phone === "string" ? body.phone.trim() : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""

  if (!phone || !code) {
    res.status(200).json({ verified: false, error: "phone and code are required" })
    return
  }

  try {
    const otp = new OtpService(req.scope)
    const out = await otp.verify(tenantId, phone, code)
    res.status(200).json(out)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(200).json({ verified: false, error: message.slice(0, 200) })
  }
}
