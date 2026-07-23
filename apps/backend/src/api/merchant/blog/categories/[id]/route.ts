import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../../modules/cms"
import type CmsModuleService from "../../../../../modules/cms/service"
import { resolveMerchant } from "../../../_helpers"
import {
  loadCategory,
  one,
  recordMerchantBlogAudit,
  resolveUniqueSlug,
} from "../../_helpers"

/**
 * GET /merchant/blog/categories/:id
 * Response: { category }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const category = await loadCategory(service, req.params.id, ctx.tenant.id)
  res.json({ category })
}

type UpdateBody = {
  name?: string
  slug?: string
  description?: string | null
}

/**
 * PUT /merchant/blog/categories/:id
 * Update name/slug/description. Slug uniqueness re-checked per-store (excludes
 * self). Ownership is fail-closed. Response: { category }
 */
const update = async (
  req: MedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}
  const tenantId = ctx.tenant.id as string

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

  await recordMerchantBlogAudit(
    service,
    ctx,
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
 * DELETE /merchant/blog/categories/:id
 * Soft-delete the category (post links detach via the join).
 * Response: { id, object: "blog_category", deleted: true }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const before = await loadCategory(service, id, ctx.tenant.id)

  await service.softDeleteCmsBlogCategories(id)

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_category.delete",
    "blog_category",
    id,
    { before }
  )

  res.json({ id, object: "blog_category", deleted: true })
}
