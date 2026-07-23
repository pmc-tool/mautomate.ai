import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../modules/cms"
import type CmsModuleService from "../../../../modules/cms/service"
import { resolveMerchant } from "../../_helpers"
import { one, recordMerchantBlogAudit, resolveUniqueSlug } from "../_helpers"

/**
 * GET /merchant/blog/authors
 * List the merchant store's blog authors, paginated. Query: q?, limit, offset.
 * Response: { authors, count, limit, offset }
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

  const [authors, count] = await service.listAndCountCmsAuthors(filters, {
    take: limit,
    skip: offset,
    order: { name: "ASC" },
  })

  res.json({ authors, count, limit, offset })
}

type CreateBody = {
  name?: string
  slug?: string
  bio?: string | null
  avatar?: string | null
}

/**
 * POST /merchant/blog/authors
 * Create an author for the merchant's store. Slug derived from name when
 * omitted (422 on collision, uniqueness scoped per-store).
 * Body: { name, slug?, bio?, avatar? }   Response: { author }
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
      "`name` is required to create an author."
    )
  }

  const slug = await resolveUniqueSlug(
    (f) => service.listCmsAuthors(f),
    body.slug,
    name,
    undefined,
    tenantId
  )

  const author = one(
    await service.createCmsAuthors({
      tenant_id: tenantId,
      name,
      slug,
      bio: body.bio ?? null,
      avatar: body.avatar ?? null,
    })
  )

  await recordMerchantBlogAudit(service, ctx, "author.create", "author", author.id, {
    after: author,
  })

  res.status(201).json({ author })
}
