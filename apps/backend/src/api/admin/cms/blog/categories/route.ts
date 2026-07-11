import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import { one, recordBlogAudit, resolveUniqueSlug } from "../_helpers"

/**
 * GET /admin/cms/blog/categories
 * List blog categories, paginated. Query: q?, limit, offset.
 * Pooled multi-tenant: scoped to the acting store (fail-closed empty list).
 * Response: { categories, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const q = (req.query.q as string | undefined)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ categories: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, unknown> = { tenant_id: tenantId }
  if (q) {
    filters.$or = [
      { name: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ]
  }

  const [categories, count] = await service.listAndCountCmsBlogCategories(
    filters,
    { take: limit, skip: offset, order: { name: "ASC" } }
  )

  res.json({ categories, count, limit, offset })
}

type CreateBody = {
  name?: string
  slug?: string
  description?: string | null
}

/**
 * POST /admin/cms/blog/categories
 * Create a blog category. Slug derived from name when omitted (422 on collision,
 * uniqueness scoped per-store). Writes require a trusted store identity.
 * Body: { name, slug?, description? }   Response: { category }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const body = req.body ?? {}

  // Pooled multi-tenant: writes bind to the authenticated store. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const name = (body.name ?? "").trim()
  if (!name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`name` is required to create a category."
    )
  }

  const slug = await resolveUniqueSlug(
    (f) => service.listCmsBlogCategories(f),
    body.slug,
    name,
    undefined,
    tenantId
  )

  const category = one(
    await service.createCmsBlogCategories({
      tenant_id: tenantId,
      name,
      slug,
      description: body.description ?? null,
    })
  )

  await recordBlogAudit(
    req,
    service,
    "blog_category.create",
    "blog_category",
    category.id,
    { after: category }
  )

  res.status(201).json({ category })
}
