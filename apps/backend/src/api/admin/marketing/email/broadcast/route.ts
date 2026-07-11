import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { sendEmail } from "../../../../../modules/marketing/email/send-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Safety cap on an admin-triggered broadcast batch. */
const MAX_RECIPIENTS = 2000

/**
 * POST /admin/marketing/email/broadcast
 *
 * Send one message to many recipients through the full pipeline. Recipients are
 * either an explicit list or every contact of the tenant that has an email and
 * has not unsubscribed ("all_contacts"). Per-recipient suppression is still
 * enforced inside `sendEmail`.
 * Body: { subject, html, template_id?, to: string[] | "all_contacts" }
 * Response: { queued, suppressed, failed }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    subject?: string
    html?: string
    template_id?: string
    to?: string[] | "all_contacts"
  }

  const subject = b.subject?.trim()
  const html = b.html

  if (!subject || !html || !b.to) {
    res.status(400).json({
      message: "`subject`, `html` and `to` are required.",
    })
    return
  }

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    // Resolve the recipient set: { email, contactId }.
    let recipients: { email: string; contactId?: string | null }[] = []

    if (b.to === "all_contacts") {
      const contacts = await svc.listMarketingContacts(
        { tenant_id: TENANT_ID, unsubscribed_at: null },
        { take: MAX_RECIPIENTS }
      )
      recipients = (Array.isArray(contacts) ? contacts : [])
        .filter((c: any) => !!c?.email && !c?.unsubscribed_at)
        .map((c: any) => ({ email: String(c.email), contactId: c.id }))
    } else if (Array.isArray(b.to)) {
      const seen = new Set<string>()
      for (const raw of b.to) {
        const email = String(raw ?? "").trim()
        if (email && !seen.has(email.toLowerCase())) {
          seen.add(email.toLowerCase())
          recipients.push({ email })
        }
        if (recipients.length >= MAX_RECIPIENTS) {
          break
        }
      }
    } else {
      res.status(400).json({
        message: "`to` must be an array of emails or \"all_contacts\".",
      })
      return
    }

    let queued = 0
    let suppressed = 0
    let failed = 0

    for (const r of recipients) {
      const result = await sendEmail(req.scope, {
        tenantId: TENANT_ID,
        to: r.email,
        contactId: r.contactId ?? null,
        templateId: b.template_id ?? null,
        subject,
        html,
      })

      if (result.suppressed) {
        suppressed++
      } else if (result.ok) {
        queued++
      } else {
        failed++
      }
    }

    res.json({ queued, suppressed, failed })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to broadcast email",
    })
  }
}
