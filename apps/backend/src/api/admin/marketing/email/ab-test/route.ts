import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { sendEmail } from "../../../../../modules/marketing/email/send-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Safety cap on an admin-triggered A/B batch. */
const MAX_RECIPIENTS = 2000

/**
 * Deterministic 50/50 split. The same email always maps to the same variant,
 * so re-runs or resends never reshuffle a contact between A and B.
 * Simple stable string hash (djb2-ish) — no crypto, no deps.
 */
const hashEmail = (email: string): number => {
  const s = String(email ?? "").trim().toLowerCase()
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  // Force to an unsigned 32-bit int.
  return h >>> 0
}

const variantFor = (email: string): "A" | "B" =>
  hashEmail(email) % 2 === 0 ? "A" : "B"

/**
 * POST /admin/marketing/email/ab-test
 *
 * Launch a subject-line A/B broadcast. One HTML body, two subject lines. Every
 * subscribed contact is deterministically bucketed into variant A or B, sent
 * the matching subject, and the created send row is tagged (best-effort) with
 * `meta = { ab_test_id, variant }` so results can be grouped later. There is no
 * new model — the test is identified by `campaign_id = ab_test_id`.
 * Body: { subject_a, subject_b, html, to?: "all_contacts" }
 * Response: { ab_test_id, sent_a, sent_b, suppressed }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    subject_a?: string
    subject_b?: string
    html?: string
    to?: "all_contacts"
  }

  const subjectA = b.subject_a?.trim()
  const subjectB = b.subject_b?.trim()
  const html = b.html

  if (!subjectA || !subjectB || !html) {
    res.status(400).json({
      message: "`subject_a`, `subject_b` and `html` are required.",
    })
    return
  }

  if (subjectA === subjectB) {
    res.status(400).json({
      message: "The two subject lines must be different.",
    })
    return
  }

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const abTestId = `abt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(
      36
    )}`

    // Recipients: every subscribed contact with an email.
    const contacts = await svc.listMarketingContacts(
      { tenant_id: TENANT_ID, unsubscribed_at: null },
      { take: MAX_RECIPIENTS }
    )

    const recipients = (Array.isArray(contacts) ? contacts : [])
      .filter((c: any) => !!c?.email && !c?.unsubscribed_at)
      .map((c: any) => ({ email: String(c.email), contactId: c.id }))

    let sentA = 0
    let sentB = 0
    let suppressed = 0

    for (const r of recipients) {
      const variant = variantFor(r.email)
      const subject = variant === "A" ? subjectA : subjectB

      const result = await sendEmail(req.scope, {
        tenantId: TENANT_ID,
        to: r.email,
        contactId: r.contactId ?? null,
        subject,
        html,
        campaignId: abTestId,
      })

      if (result.suppressed) {
        suppressed++
        continue
      }

      if (result.ok) {
        if (variant === "A") {
          sentA++
        } else {
          sentB++
        }
      }

      // Best-effort tag of the created send row with its variant.
      if (result.sendId) {
        try {
          await svc.updateMarketingEmailSends({
            id: result.sendId,
            meta: { ab_test_id: abTestId, variant },
          } as any)
        } catch {
          // swallow — tagging is best-effort, never fail the broadcast.
        }
      }
    }

    res.json({
      ab_test_id: abTestId,
      sent_a: sentA,
      sent_b: sentB,
      suppressed,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to launch A/B test",
    })
  }
}
