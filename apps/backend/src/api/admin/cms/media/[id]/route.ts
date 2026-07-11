import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import { normalizeLocaleText, recordMediaAudit } from "../_helpers"

/**
 * Load a media row and assert it belongs to `tenantId`, or throw NOT_FOUND.
 * Pooled multi-tenant: a media id from another store — or any access without a
 * resolvable tenant — is treated as not-found (fail-closed, no cross-tenant read
 * or mutation).
 */
async function loadMedia(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  let media: any
  try {
    media = await service.retrieveCmsMedia(id)
  } catch {
    media = null
  }
  if (!media || !tenantId || (media.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Media with id "${id}" was not found.`
    )
  }
  return media
}

/**
 * GET /admin/cms/media/:id
 * Retrieve a single media row. Response: { media }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const media = await loadMedia(service, req.params.id, tenantId)
  res.json({ media })
}

type UpdateBody = {
  alt?: unknown
  title?: unknown
  folder_id?: string | null
}

/**
 * Update media METADATA only — alt / title (per-locale) and folder assignment.
 * No re-upload: the underlying File Module bytes are untouched.
 * Body: { alt?, title?, folder_id? }  Response: { media }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  // Pooled multi-tenant: writes require a trusted store identity + ownership.
  const tenantId = await requireWriteTenant(req)
  const existing = await loadMedia(service, id, tenantId)

  const patch: Record<string, any> = { id }
  const body = req.body ?? {}

  if ("alt" in body) {
    patch.alt = normalizeLocaleText(body.alt)
  }
  if ("title" in body) {
    patch.title = normalizeLocaleText(body.title)
  }
  if ("folder_id" in body) {
    // Allow null (move to root) or a folder id.
    patch.folder_id = body.folder_id ?? null
  }

  const saved = await service.updateCmsMedias(patch)
  const media = Array.isArray(saved) ? saved[0] : saved

  await recordMediaAudit(req, service, "media.update", id, {
    before: existing,
    after: media,
  })

  res.json({ media })
}

export const POST = update
export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/media/:id
 * Delete the underlying File Module bytes, then soft-delete the catalog row,
 * then write an audit row.
 *
 * NOTE (reference-check deferred): phase-0-architecture.md §7.2 calls for a
 * 409 when the asset is still referenced by a draft section or live snapshot.
 * Those models (cms_section / cms_snapshot) do not exist until a later phase, so
 * the ref-check is intentionally skipped in Phase 2 and must be added when the
 * page/snapshot models land.
 *
 * Response: { id, object: "media", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  // Pooled multi-tenant: writes require a trusted store identity + ownership.
  const tenantId = await requireWriteTenant(req)
  const media = await loadMedia(service, id, tenantId)

  // Delete the bytes from the File Module first (best-effort; a missing file
  // must not block removing the catalog row).
  if (media.file_id) {
    try {
      await deleteFilesWorkflow(req.scope).run({
        input: { ids: [media.file_id] },
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[cms] failed to delete file ${media.file_id} from storage (continuing):`,
        e
      )
    }
  }

  await service.softDeleteCmsMedias(id)

  await recordMediaAudit(req, service, "media.delete", id, { before: media })

  res.json({ id, object: "media", deleted: true })
}
