import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../../modules/cms"
import type CmsModuleService from "../../../../../modules/cms/service"
import { resolveMerchant } from "../../../_helpers"
import {
  loadAuthor,
  one,
  recordMerchantBlogAudit,
  resolveUniqueSlug,
} from "../../_helpers"

/**
 * GET /merchant/blog/authors/:id
 * Response: { author }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const author = await loadAuthor(service, req.params.id, ctx.tenant.id)
  res.json({ author })
}

type UpdateBody = {
  name?: string
  slug?: string
  bio?: string | null
  avatar?: string | null
}

/**
 * PUT /merchant/blog/authors/:id
 * Update name/slug/bio/avatar. Slug uniqueness re-checked per-store (excludes
 * self). Ownership is fail-closed. Response: { author }
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

  const before = await loadAuthor(service, id, tenantId)

  const patch: Record<string, unknown> = { id }
  if ("name" in body) patch.name = body.name
  if ("bio" in body) patch.bio = body.bio
  if ("avatar" in body) patch.avatar = body.avatar

  if (body.slug && body.slug !== before.slug) {
    patch.slug = await resolveUniqueSlug(
      (f) => service.listCmsAuthors(f),
      body.slug,
      body.name ?? before.name,
      id,
      tenantId
    )
  }

  const author = one(await service.updateCmsAuthors(patch))

  await recordMerchantBlogAudit(service, ctx, "author.update", "author", id, {
    before,
    after: author,
  })

  res.json({ author })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /merchant/blog/authors/:id
 * Soft-delete the author (posts keep rendering with a null author).
 * Response: { id, object: "author", deleted: true }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const before = await loadAuthor(service, id, ctx.tenant.id)

  await service.softDeleteCmsAuthors(id)

  await recordMerchantBlogAudit(service, ctx, "author.delete", "author", id, {
    before,
  })

  res.json({ id, object: "author", deleted: true })
}
