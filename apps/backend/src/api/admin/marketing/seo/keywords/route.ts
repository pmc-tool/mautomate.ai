import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/seo/keywords
 *
 * Paginated list of keywords, tenant-scoped. Optional filters (query string):
 * seo_project_id, status.
 * Response: { keywords, count, limit, offset }
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
    if (req.query.status) {
      filters.status = req.query.status
    }

    const [keywords, count] = await svc.listAndCountMarketingKeywords(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ keywords, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list keywords",
    })
  }
}

/**
 * POST /admin/marketing/seo/keywords
 *
 * Create a keyword under a project. `seo_project_id` and `term` are required.
 * `volume` / `difficulty` are left null (populated later by an external SEO API).
 * Body: { seo_project_id, term, intent?, volume?, difficulty?, status? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    seo_project_id?: string
    term?: string
    intent?: string
    volume?: number | null
    difficulty?: number | null
    status?: string
  }

  try {
    const term = b.term?.trim()
    if (!term) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A keyword `term` is required."
      )
    }
    if (!b.seo_project_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `seo_project_id` is required."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    // Verify the parent project belongs to this tenant.
    const project = await svc
      .retrieveMarketingSeoProject(b.seo_project_id)
      .catch(() => null)
    if (!project || (project as any).tenant_id !== TENANT_ID) {
      res
        .status(404)
        .json({ message: `SEO project ${b.seo_project_id} was not found` })
      return
    }

    const status =
      b.status && ["tracked", "targeted", "ranking"].includes(b.status)
        ? b.status
        : "tracked"

    const created = await svc.createMarketingKeywords({
      tenant_id: TENANT_ID,
      seo_project_id: b.seo_project_id,
      term,
      intent: b.intent?.trim() || null,
      volume: typeof b.volume === "number" ? b.volume : null,
      difficulty: typeof b.difficulty === "number" ? b.difficulty : null,
      status,
    } as any)

    const keyword = Array.isArray(created) ? created[0] : created

    res.status(201).json({ keyword })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create keyword",
    })
  }
}
