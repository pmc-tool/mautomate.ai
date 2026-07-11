import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/scoring/leaderboard?limit=20
 *
 * Highest-scoring contacts for the tenant (score desc).
 * Response: { contacts }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const rawLimit = parseInt((req.query.limit as string) ?? "20")
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 100)
      : 20

    let contacts: any[] = []
    try {
      const scoringService = require("../../../../../modules/marketing/scoring/scoring-service")
      contacts = await scoringService.getTopContacts(req.scope, {
        tenantId: TENANT_ID,
        limit,
      })
    } catch {
      contacts = []
    }

    res.json({ contacts: Array.isArray(contacts) ? contacts : [] })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load leaderboard",
    })
  }
}
