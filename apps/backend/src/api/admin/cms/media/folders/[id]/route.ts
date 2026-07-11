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

function slugSegment(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "folder"
  )
}

/**
 * Load a folder and assert it belongs to `tenantId`. A folder id from another
 * store — or any access without a resolvable tenant — is treated as not-found
 * (fail-closed, no cross-tenant read or mutation).
 */
async function loadFolder(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  const folder = await service.retrieveCmsMediaFolder(id).catch(() => null)
  if (!folder || !tenantId || (folder.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Folder "${id}" was not found.`
    )
  }
  return folder
}

/**
 * GET /admin/cms/media/folders/:id — retrieve one folder. Response: { folder }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const folder = await loadFolder(service, req.params.id, tenantId)
  res.json({ folder })
}

type UpdateBody = { name?: string }

/**
 * Rename a folder. Body: { name }. Recomputes the leaf segment of `path`
 * (keeps the parent prefix). Writes require a trusted store identity + ownership.
 * Response: { folder }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)
  const existing = await loadFolder(service, id, tenantId)

  const patch: Record<string, any> = { id }
  const name = req.body?.name?.trim()
  if (name) {
    patch.name = name
    const prefix = existing.path.slice(0, existing.path.lastIndexOf("/"))
    patch.path = `${prefix}/${slugSegment(name)}`
  }

  const saved = await service.updateCmsMediaFolders(patch)
  const folder = Array.isArray(saved) ? saved[0] : saved
  res.json({ folder })
}

export const POST = update
export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/media/folders/:id — soft-delete a folder.
 * Minimal: does NOT cascade. Media in a deleted folder keep their folder_id;
 * the UI should treat an orphaned folder_id as root.
 * Response: { id, object: "media_folder", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)
  await loadFolder(service, id, tenantId)

  await service.softDeleteCmsMediaFolders(id)
  res.json({ id, object: "media_folder", deleted: true })
}
