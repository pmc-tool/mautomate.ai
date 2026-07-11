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
 * Load an author and assert it belongs to `tenantId`. An author id from another
 * store — or any access without a resolvable tenant — is treated as not-found
 * (fail-closed, no cross-tenant read or mutation).
 */
async function loadAuthor(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  let author: any
  try {
    author = await service.retrieveCmsAuthor(id)
  } catch {
    author = null
  }
  if (!author || !tenantId || (author.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Author with id "${id}" was not found.`
    )
  }
  return author
}

/**
 * GET /admin/cms/blog/authors/:id
 * Response: { author }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const author = await loadAuthor(service, req.params.id, tenantId)
  res.json({ author })
}

type UpdateBody = {
  name?: string
  slug?: string
  bio?: string | null
  avatar?: string | null
}

/**
 * PUT /admin/cms/blog/authors/:id
 * Update name/slug/bio/avatar. Slug uniqueness re-checked per-store (excludes
 * self). Writes require a trusted store identity + ownership.
 * Response: { author }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}

  const tenantId = await requireWriteTenant(req)
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

  await recordBlogAudit(req, service, "author.update", "author", id, {
    before,
    after: author,
  })

  res.json({ author })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/blog/authors/:id
 * Soft-delete the author. Posts referencing this author keep their author_id
 * (the byline simply resolves to null on the store until reassigned).
 * Response: { id, object: "author", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)
  const before = await loadAuthor(service, id, tenantId)

  await service.softDeleteCmsAuthors(id)

  await recordBlogAudit(req, service, "author.delete", "author", id, {
    before,
  })

  res.json({ id, object: "author", deleted: true })
}
