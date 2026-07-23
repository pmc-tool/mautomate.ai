import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../modules/cms"
import type CmsModuleService from "../../../../modules/cms/service"
import { resolveMerchant } from "../../_helpers"
import { one, recordMerchantBlogAudit, resolveUniqueSlug } from "../_helpers"

/**
 * GET /merchant/blog/categories
 * List the merchant store's blog categories, paginated. Query: q?, limit, offset.
 * Response: { categories, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const q = (req.query.q as string | undefined)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  const filters: Record<string, unknown> = { tenant_id: ctx.tenant.id }
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
 * POST /merchant/blog/categories
 * Create a blog category for the merchant's store. Slug derived from name when
 * omitted (422 on collision, uniqueness scoped per-store).
 * Body: { name, slug?, description? }   Response: { category }
 */
export const POST = async (
  req: MedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const body = req.body ?? {}
  const tenantId = ctx.tenant.id as string

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

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_category.create",
    "blog_category",
    category.id,
    { after: category }
  )

  res.status(201).json({ category })
}
