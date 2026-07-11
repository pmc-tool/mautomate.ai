import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/seo/projects/:id
 *
 * Retrieve a single SEO project bundled with its keywords and blog articles.
 * Tenant-scoped (404 on cross-tenant).
 * Response: { project, keywords, articles }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const project = await svc.retrieveMarketingSeoProject(id)
    if (
      (project as any)?.tenant_id &&
      (project as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `SEO project ${id} was not found` })
      return
    }

    const keywords = await svc.listMarketingKeywords(
      { tenant_id: TENANT_ID, seo_project_id: id },
      { take: 500, order: { created_at: "DESC" } }
    )

    // Articles link to a brief; briefs carry the project id. Gather briefs for
    // this project, then the articles written from them.
    const briefs = await svc.listMarketingContentBriefs(
      { tenant_id: TENANT_ID, seo_project_id: id },
      { take: 500 }
    )
    const briefIds = (briefs as any[]).map((x) => x.id)
    let articles: any[] = []
    if (briefIds.length) {
      articles = (await svc.listMarketingBlogArticles(
        { tenant_id: TENANT_ID, brief_id: briefIds },
        { take: 500, order: { created_at: "DESC" } }
      )) as any[]
    }

    res.json({ project, keywords, briefs, articles })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve SEO project",
    })
  }
}

/**
 * POST /admin/marketing/seo/projects/:id
 *
 * Update an SEO project's fields. Tenant-scoped.
 * Body: { name?, domain?, target_locale? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    name?: string
    domain?: string | null
    target_locale?: string | null
  }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingSeoProject(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `SEO project ${id} was not found` })
      return
    }

    const data: Record<string, unknown> = {}
    if (b.name !== undefined) {
      const name = b.name?.trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.domain !== undefined) {
      data.domain = b.domain?.trim() || null
    }
    if (b.target_locale !== undefined) {
      data.target_locale = b.target_locale?.trim() || null
    }

    await svc.updateMarketingSeoProjects({ id, ...data } as any)
    const project = await svc.retrieveMarketingSeoProject(id)

    res.json({ project })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update SEO project",
    })
  }
}

/**
 * DELETE /admin/marketing/seo/projects/:id
 *
 * Delete an SEO project (tenant-scoped). Verifies ownership before deleting.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingSeoProject(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `SEO project ${id} was not found` })
      return
    }

    await svc.deleteMarketingSeoProjects(id)

    res.json({ id, object: "marketing_seo_project", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete SEO project",
    })
  }
}
