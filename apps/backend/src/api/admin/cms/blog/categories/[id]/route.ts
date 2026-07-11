import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import { one, recordBlogAudit, resolveUniqueSlug } from "../../_helpers"

/**
 * Load a category and assert it belongs to `tenantId`. A category id from
 * another store — or any access without a resolvable tenant — is treated as
 * not-found (fail-closed, no cross-tenant read or mutation).
 */
async function loadCategory(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  let category: any
  try {
    category = await service.retrieveCmsBlogCategory(id)
  } catch {
    category = null
  }
  if (!category || !tenantId || (category.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Blog category with id "${id}" was not found.`
    )
  }
  return category
}

/**
 * GET /admin/cms/blog/categories/:id
 * Response: { category }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const category = await loadCategory(service, req.params.id, tenantId)
  res.json({ category })
}

type UpdateBody = {
  name?: string
  slug?: string
  description?: string | null
}

/**
 * PUT /admin/cms/blog/categories/:id
 * Update name/slug/description. Slug uniqueness re-checked per-store (excludes
 * self). Writes require a trusted store identity + ownership.
 * Response: { category }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}

  const tenantId = await requireWriteTenant(req)
  const before = await loadCategory(service, id, tenantId)

  const patch: Record<string, unknown> = { id }
  if ("name" in body) patch.name = body.name
  if ("description" in body) patch.description = body.description

  if (body.slug && body.slug !== before.slug) {
    patch.slug = await resolveUniqueSlug(
      (f) => service.listCmsBlogCategories(f),
      body.slug,
      body.name ?? before.name,
      id,
      tenantId
    )
  }

  const category = one(await service.updateCmsBlogCategories(patch))

  await recordBlogAudit(
    req,
    service,
    "blog_category.update",
    "blog_category",
    id,
    { before, after: category }
  )

  res.json({ category })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/blog/categories/:id
 * Soft-delete the category (post links detach via the join).
 * Response: { id, object: "blog_category", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)
  const before = await loadCategory(service, id, tenantId)

  await service.softDeleteCmsBlogCategories(id)

  await recordBlogAudit(
    req,
    service,
    "blog_category.delete",
    "blog_category",
    id,
    { before }
  )

  res.json({ id, object: "blog_category", deleted: true })
}
