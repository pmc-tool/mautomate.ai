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
 * GET /admin/cms/blog/authors
 * List authors, paginated. Query: q?, limit, offset.
 * Pooled multi-tenant: scoped to the acting store (fail-closed empty list).
 * Response: { authors, count, limit, offset }
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
    res.json({ authors: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, unknown> = { tenant_id: tenantId }
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
 * POST /admin/cms/blog/authors
 * Create an author. Slug derived from name when omitted (422 on collision,
 * uniqueness scoped per-store). Writes require a trusted store identity.
 * Body: { name, slug?, bio?, avatar? }   Response: { author }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const body = req.body ?? {}

  const tenantId = await requireWriteTenant(req)

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

  await recordBlogAudit(req, service, "author.create", "author", author.id, {
    after: author,
  })

  res.status(201).json({ author })
}
