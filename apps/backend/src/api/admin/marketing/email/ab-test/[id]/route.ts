import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Hard cap on the number of send rows scanned per test. */
const SCAN_CAP = 5000

/** Statuses that count as a successfully dispatched message. */
const SENT_STATUSES = new Set(["sent", "delivered", "opened", "clicked"])

type VariantStats = {
  subject: string
  sent: number
  opened: number
  clicked: number
  open_rate: number
  click_rate: number
}

const emptyVariant = (): VariantStats => ({
  subject: "",
  sent: 0,
  opened: 0,
  clicked: 0,
  open_rate: 0,
  click_rate: 0,
})

/**
 * GET /admin/marketing/email/ab-test/:id
 *
 * Results for one subject-line A/B test. Lists the campaign's send rows, groups
 * them by `meta.variant` (A/B), tallies sent/opened/clicked, and picks a winner
 * by open rate then click rate. Defensive: never throws — degrades to an empty
 * result on any failure.
 * Response: { ab_test_id, subject_a, subject_b, variants: { A, B }, winner }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const abTestId = String(req.params.id ?? "")

  const A = emptyVariant()
  const B = emptyVariant()

  const finalize = (
    winner: "A" | "B" | "tie" | null
  ): void => {
    A.open_rate = A.sent ? A.opened / A.sent : 0
    A.click_rate = A.sent ? A.clicked / A.sent : 0
    B.open_rate = B.sent ? B.opened / B.sent : 0
    B.click_rate = B.sent ? B.clicked / B.sent : 0

    res.json({
      ab_test_id: abTestId,
      subject_a: A.subject,
      subject_b: B.subject,
      variants: { A, B },
      winner,
    })
  }

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const rows = await svc
      .listMarketingEmailSends(
        { tenant_id: TENANT_ID, campaign_id: abTestId },
        { take: SCAN_CAP, order: { created_at: "DESC" } }
      )
      .catch(() => [])

    for (const r of Array.isArray(rows) ? rows : []) {
      const meta = (r?.meta ?? {}) as any
      const variant = meta?.variant === "B" ? "B" : meta?.variant === "A" ? "A" : null
      if (!variant) {
        continue
      }

      const bucket = variant === "A" ? A : B
      const status = String(r?.status ?? "")
      const opens = Number(r?.open_count ?? 0)
      const clicks = Number(r?.click_count ?? 0)
      const subject = String(r?.subject ?? "")

      if (subject && !bucket.subject) {
        bucket.subject = subject
      }

      // Suppressed rows never went out — exclude them from the denominator.
      if (SENT_STATUSES.has(status)) {
        bucket.sent++
      }
      if (opens > 0 || status === "opened" || status === "clicked") {
        bucket.opened++
      }
      if (clicks > 0 || status === "clicked") {
        bucket.clicked++
      }
    }

    // Compute rates for the winner decision.
    const aOpen = A.sent ? A.opened / A.sent : 0
    const bOpen = B.sent ? B.opened / B.sent : 0
    const aClick = A.sent ? A.clicked / A.sent : 0
    const bClick = B.sent ? B.clicked / B.sent : 0

    let winner: "A" | "B" | "tie" | null = null
    if (A.sent > 0 || B.sent > 0) {
      if (aOpen > bOpen) {
        winner = "A"
      } else if (bOpen > aOpen) {
        winner = "B"
      } else if (aClick > bClick) {
        winner = "A"
      } else if (bClick > aClick) {
        winner = "B"
      } else {
        winner = "tie"
      }
    }

    finalize(winner)
  } catch {
    // Never throw — the results view should still render.
    finalize(null)
  }
}
