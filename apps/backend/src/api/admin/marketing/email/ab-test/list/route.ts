import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Hard cap on the number of send rows scanned to build the test list. */
const SCAN_CAP = 5000

type TestSummary = {
  ab_test_id: string
  sends: number
  created_at: string | null
}

/**
 * GET /admin/marketing/email/ab-test/list
 *
 * Recent subject-line A/B tests, newest first. Derived from the send rows:
 * distinct `campaign_id`s that start with `abt_`, each with a basic send count
 * and the timestamp of its most recent send. Defensive: never throws.
 * Response: { tests }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const rows = await svc
      .listMarketingEmailSends(
        { tenant_id: TENANT_ID },
        { take: SCAN_CAP, order: { created_at: "DESC" } }
      )
      .catch(() => [])

    const byId = new Map<string, TestSummary>()

    for (const r of Array.isArray(rows) ? rows : []) {
      const id = String(r?.campaign_id ?? "")
      if (!id.startsWith("abt_")) {
        continue
      }

      const createdAt = r?.created_at ? new Date(r.created_at).toISOString() : null

      const existing = byId.get(id)
      if (existing) {
        existing.sends++
        // Rows arrive newest-first, so the first seen is the latest — keep it.
        if (!existing.created_at && createdAt) {
          existing.created_at = createdAt
        }
      } else {
        byId.set(id, { ab_test_id: id, sends: 1, created_at: createdAt })
      }
    }

    const tests = Array.from(byId.values()).sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return tb - ta
    })

    res.json({ tests })
  } catch {
    // Never throw — the list should still render (empty).
    res.json({ tests: [] })
  }
}
