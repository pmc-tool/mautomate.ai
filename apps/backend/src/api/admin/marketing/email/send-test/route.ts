import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { sendEmail } from "../../../../../modules/marketing/email/send-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/email/send-test
 *
 * Fire a single real email through the full send pipeline (suppression check ->
 * tracking injection -> provider -> recorded row) to verify the transport.
 * Body: { to, subject, html }
 * Response: { ok, sendId, suppressed?, error? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    to?: string
    subject?: string
    html?: string
  }

  const to = b.to?.trim()
  const subject = b.subject?.trim()
  const html = b.html

  if (!to || !subject || !html) {
    res.status(400).json({
      ok: false,
      message: "`to`, `subject` and `html` are required.",
    })
    return
  }

  try {
    const result = await sendEmail(req.scope, {
      tenantId: TENANT_ID,
      to,
      subject,
      html,
    })

    res.status(result.ok ? 200 : 400).json({
      ok: result.ok,
      sendId: result.sendId,
      suppressed: result.suppressed,
      error: result.error,
    })
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      message: e?.message ?? "Failed to send test email",
    })
  }
}
