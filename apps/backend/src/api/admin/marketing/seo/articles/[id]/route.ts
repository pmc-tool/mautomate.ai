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

const ALLOWED_STATUS = ["draft", "review", "published"] as const

/**
 * Load the article's cached draft body + meta from its source brief's outline.
 * The article row has no body column, so the content lives on the brief (see the
 * seo-service header). Returns nulls when the brief is gone.
 */
const loadCachedBody = async (
  svc: MarketingModuleService,
  briefId: string | null | undefined
): Promise<{ body: string; meta_description: string; outline: any }> => {
  if (!briefId) {
    return { body: "", meta_description: "", outline: null }
  }
  try {
    const brief = await svc.retrieveMarketingContentBrief(briefId)
    if ((brief as any)?.tenant_id !== TENANT_ID) {
      return { body: "", meta_description: "", outline: null }
    }
    const outline = ((brief as any).outline ?? {}) as Record<string, unknown>
    return {
      body: typeof outline.draft_body === "string" ? outline.draft_body : "",
      meta_description:
        typeof outline.draft_meta === "string" ? outline.draft_meta : "",
      outline,
    }
  } catch {
    return { body: "", meta_description: "", outline: null }
  }
}

/**
 * GET /admin/marketing/seo/articles/:id
 *
 * Retrieve a single blog article plus its cached draft body/meta (from the
 * source brief). Tenant-scoped (404 on cross-tenant).
 * Response: { article, body, meta_description }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const article = await svc.retrieveMarketingBlogArticle(id)
    if (
      (article as any)?.tenant_id &&
      (article as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Article ${id} was not found` })
      return
    }

    const cached = await loadCachedBody(svc, (article as any).brief_id)

    res.json({
      article,
      body: cached.body,
      meta_description: cached.meta_description,
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve article",
    })
  }
}

/**
 * POST /admin/marketing/seo/articles/:id
 *
 * Update an article. Editable: title, status, seo_score. When `body` / `meta`
 * are supplied they are written back to the source brief's cached outline
 * (`draft_body` / `draft_meta`) since the article row has no body column.
 * Body: { title?, status?, seo_score?, body?, meta_description? }
 * Response: { article, body, meta_description }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    title?: string
    status?: string
    seo_score?: number
    body?: string
    meta_description?: string
  }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingBlogArticle(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Article ${id} was not found` })
      return
    }

    const data: Record<string, unknown> = {}
    if (b.title !== undefined) {
      data.title = b.title?.trim() || null
    }
    if (b.status !== undefined) {
      if (!ALLOWED_STATUS.includes(b.status as any)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `\`status\` must be one of ${ALLOWED_STATUS.join(", ")}.`
        )
      }
      data.status = b.status
    }
    if (typeof b.seo_score === "number") {
      data.seo_score = b.seo_score
    }

    if (Object.keys(data).length) {
      await svc.updateMarketingBlogArticles({ id, ...data } as any)
    }

    // Persist body/meta edits back onto the source brief's cached outline.
    const briefId = (current as any).brief_id as string | null
    if ((b.body !== undefined || b.meta_description !== undefined) && briefId) {
      try {
        const brief = await svc.retrieveMarketingContentBrief(briefId)
        if ((brief as any)?.tenant_id === TENANT_ID) {
          const outline = ((brief as any).outline ?? {}) as Record<
            string,
            unknown
          >
          await svc.updateMarketingContentBriefs({
            id: briefId,
            outline: {
              ...outline,
              ...(b.body !== undefined ? { draft_body: b.body } : {}),
              ...(b.meta_description !== undefined
                ? { draft_meta: b.meta_description }
                : {}),
            },
          } as any)
        }
      } catch {
        // best-effort: body cache is secondary to the article row.
      }
    }

    const article = await svc.retrieveMarketingBlogArticle(id)
    const cached = await loadCachedBody(svc, briefId)

    res.json({
      article,
      body: cached.body,
      meta_description: cached.meta_description,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update article",
    })
  }
}

/**
 * DELETE /admin/marketing/seo/articles/:id
 *
 * Delete an article (tenant-scoped). Verifies ownership before deleting.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingBlogArticle(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Article ${id} was not found` })
      return
    }

    await svc.deleteMarketingBlogArticles(id)

    res.json({ id, object: "marketing_blog_article", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete article",
    })
  }
}
