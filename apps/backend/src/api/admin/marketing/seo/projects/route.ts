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
 * GET /admin/marketing/seo/projects
 *
 * Paginated list of SEO projects, tenant-scoped.
 * Response: { projects, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [projects, count] = await svc.listAndCountMarketingSeoProjects(
      { tenant_id: TENANT_ID },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ projects, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list SEO projects",
    })
  }
}

/**
 * POST /admin/marketing/seo/projects
 *
 * Create an SEO project. `name` is required.
 * Body: { name, domain?, target_locale? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    domain?: string
    target_locale?: string
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An SEO project `name` is required."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingSeoProjects({
      tenant_id: TENANT_ID,
      name,
      domain: b.domain?.trim() || null,
      target_locale: b.target_locale?.trim() || null,
    } as any)

    const project = Array.isArray(created) ? created[0] : created

    res.status(201).json({ project })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create SEO project",
    })
  }
}
