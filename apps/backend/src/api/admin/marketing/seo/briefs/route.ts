import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { generateBrief } from "../../../../../modules/marketing/seo/seo-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/seo/briefs
 *
 * Paginated list of content briefs, tenant-scoped. Optional filters (query
 * string): seo_project_id, keyword_id, status.
 * Response: { briefs, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "200")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (req.query.seo_project_id) {
      filters.seo_project_id = req.query.seo_project_id
    }
    if (req.query.keyword_id) {
      filters.keyword_id = req.query.keyword_id
    }
    if (req.query.status) {
      filters.status = req.query.status
    }

    const [briefs, count] = await svc.listAndCountMarketingContentBriefs(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ briefs, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list briefs",
    })
  }
}

/**
 * POST /admin/marketing/seo/briefs
 *
 * Generate a content brief for a keyword (AI outline, persisted as status
 * "ready"). Degrades to a minimal outline + `needs_ai` when no AI provider is
 * configured (never 500).
 * Body: { seo_project_id?, keyword_id }
 * Response: { brief, needs_ai }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    seo_project_id?: string
    keyword_id?: string
  }

  try {
    if (!b.keyword_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `keyword_id` is required to generate a brief."
      )
    }

    const result = await generateBrief(req.scope, {
      tenantId: TENANT_ID,
      seoProjectId: b.seo_project_id,
      keywordId: b.keyword_id,
    })

    if (!result.brief) {
      res
        .status(404)
        .json({ message: `Keyword ${b.keyword_id} was not found` })
      return
    }

    res.status(201).json({
      brief: result.brief,
      needs_ai: result.needs_ai ?? false,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate brief",
    })
  }
}
