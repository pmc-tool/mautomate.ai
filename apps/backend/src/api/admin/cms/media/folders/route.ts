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

/** slugify a folder name segment for the materialized path. */
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
 * GET /admin/cms/media/folders
 * List folders (optionally filtered by parent_id; "root"|"null" => top level).
 * Pooled multi-tenant: scoped to the acting store (fail-closed empty list).
 * Response: { folders, count }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ folders: [], count: 0 })
    return
  }

  const rawParent = req.query.parent_id as string | undefined
  const filters: Record<string, any> = { tenant_id: tenantId }
  if (rawParent !== undefined && rawParent !== "") {
    filters.parent_id =
      rawParent === "root" || rawParent === "null" ? null : rawParent
  }

  const [folders, count] = await service.listAndCountCmsMediaFolders(filters, {
    order: { path: "ASC" },
  })

  res.json({ folders, count })
}

type CreateBody = { name?: string; parent_id?: string | null }

/**
 * POST /admin/cms/media/folders
 * Create a folder. Body: { name, parent_id? }. The materialized `path` is
 * derived from the parent path + slugified name. Writes require a trusted store
 * identity; a parent folder must belong to the SAME store (fail-closed).
 * Response: 201 { folder }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const tenantId = await requireWriteTenant(req)

  const name = req.body?.name?.trim()
  if (!name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`name` is required to create a folder."
    )
  }

  const parentId = req.body?.parent_id ?? null
  let basePath = ""
  if (parentId) {
    const parent = await service
      .retrieveCmsMediaFolder(parentId)
      .catch(() => null)
    // Ownership guard: never nest under another store's folder.
    if (!parent || (parent.tenant_id ?? null) !== tenantId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Parent folder "${parentId}" was not found.`
      )
    }
    basePath = parent.path
  }

  const path = `${basePath}/${slugSegment(name)}`

  const saved = await service.createCmsMediaFolders({
    tenant_id: tenantId,
    name,
    path,
    parent_id: parentId,
  })
  const folder = Array.isArray(saved) ? saved[0] : saved

  res.status(201).json({ folder })
}
