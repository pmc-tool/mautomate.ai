import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/seo/articles
 *
 * Paginated list of blog articles, tenant-scoped. Optional filters (query
 * string): brief_id, status. To scope by project, pass `seo_project_id` — the
 * route resolves the project's briefs and lists their articles.
 * Response: { articles, count, limit, offset }
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
    if (req.query.brief_id) {
      filters.brief_id = req.query.brief_id
    }
    if (req.query.status) {
      filters.status = req.query.status
    }

    // Optional project scoping via the article's source brief.
    if (req.query.seo_project_id) {
      const briefs = await svc.listMarketingContentBriefs(
        { tenant_id: TENANT_ID, seo_project_id: req.query.seo_project_id },
        { take: 1000 }
      )
      const briefIds = (briefs as any[]).map((x) => x.id)
      if (!briefIds.length) {
        res.json({ articles: [], count: 0, limit, offset })
        return
      }
      filters.brief_id = briefIds
    }

    const [articles, count] = await svc.listAndCountMarketingBlogArticles(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ articles, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list articles",
    })
  }
}
