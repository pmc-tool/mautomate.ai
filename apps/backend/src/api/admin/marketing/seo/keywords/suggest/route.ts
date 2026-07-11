import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { suggestKeywords } from "../../../../../../modules/marketing/seo/seo-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/seo/keywords/suggest
 *
 * Brainstorm keyword ideas grounded in the store's catalog. Does NOT persist —
 * the UI lets the user pick which ideas to add (POST /seo/keywords). When no AI
 * provider is configured, returns `{ keywords: [], needs_ai: true }` (never 500).
 * Body: { seo_project_id?, seed_term, count? }
 * Response: { keywords, needs_ai }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    seo_project_id?: string
    seed_term?: string
    count?: number
  }

  try {
    const seedTerm = b.seed_term?.trim()
    if (!seedTerm) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `seed_term` is required to suggest keywords."
      )
    }

    const result = await suggestKeywords(req.scope, {
      tenantId: TENANT_ID,
      seoProjectId: b.seo_project_id,
      seedTerm,
      count: b.count,
    })

    res.json({
      keywords: result.keywords,
      needs_ai: result.needs_ai ?? false,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to suggest keywords",
    })
  }
}
