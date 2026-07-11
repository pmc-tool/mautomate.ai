import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  uploadFilesWorkflow,
  deleteFilesWorkflow,
} from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"
import {
  assertAllowedMime,
  checksumOf,
  extractDimensions,
  MAX_UPLOAD_BYTES,
  normalizeLocaleText,
  recordMediaAudit,
  tenantScopedUploadFilename,
  type UploadedFile,
} from "./_helpers"

/**
 * GET /admin/cms/media
 * List media (newest first) with optional filters + pagination.
 * Query: folder_id ("root"|"null" => root), q (filename contains), mime_type,
 *        limit (default 50), offset (default 0).
 * Response: { media, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const q = (req.query.q as string | undefined)?.trim()
  const mimeType = req.query.mime_type as string | undefined
  const rawFolder = req.query.folder_id as string | undefined
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  // Pooled multi-tenant: scope the library to the acting store. Fail-closed.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ media: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, any> = { tenant_id: tenantId }

  if (rawFolder !== undefined && rawFolder !== "") {
    filters.folder_id =
      rawFolder === "root" || rawFolder === "null" ? null : rawFolder
  }
  if (mimeType) {
    filters.mime_type = mimeType
  }
  if (q) {
    filters.original_filename = { $ilike: `%${q}%` }
  }

  const [media, count] = await service.listAndCountCmsMedias(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.json({ media, count, limit, offset })
}

/**
 * POST /admin/cms/media  (multipart/form-data)
 * Upload one or more files (field name `files`) into the File Module via the
 * built-in uploadFilesWorkflow, then create a cms_media catalog row per file.
 *
 * Reused flow (phase-0-architecture.md §7.2): the same uploadFilesWorkflow the
 * built-in /admin/uploads route uses owns the bytes; this route additionally
 * persists the metadata Medusa's File Module does not keep (size, dimensions,
 * checksum, alt/title, folder, uploader) and writes an audit row.
 *
 * Extra (optional) form fields applied to ALL files in the request:
 *   folder_id  -> assign to a folder (omit for root)
 *   alt        -> string or JSON locale-map ({ en, bn })
 *   title      -> string or JSON locale-map
 *
 * Compensation: if a catalog row insert fails after bytes are stored, the
 * just-uploaded File Module files are deleted so storage never leaks.
 *
 * Response: 201 { media: CmsMedia[] }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: uploads require a resolvable store. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const files = (req as any).files as UploadedFile[] | undefined
  if (!files?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded. Send multipart/form-data with one or more `files` fields."
    )
  }

  // Validate every file up-front (mime + size) before touching storage.
  for (const f of files) {
    assertAllowedMime(f.mimetype)
    if (f.size > MAX_UPLOAD_BYTES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `File "${f.originalname}" exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`
      )
    }
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const folderId = (body.folder_id as string | undefined) || null
  const alt = normalizeLocaleText(body.alt)
  const title = normalizeLocaleText(body.title)
  const createdBy = (req as any).cms_actor?.user_id ?? null

  // 1) Store bytes via the File Module (reuses the built-in upload workflow).
  const { result: uploaded } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: files.map((f) => ({
        filename: tenantScopedUploadFilename(tenantId, f.originalname),
        mimeType: f.mimetype,
        content: f.buffer.toString("base64"),
        access: "public" as const,
      })),
    },
  })

  // 2) Build catalog rows (with per-file dimensions + checksum).
  const uploadedIds = (uploaded as { id: string; url: string }[]).map(
    (u) => u.id
  )

  let created: any[]
  try {
    const rows = await Promise.all(
      files.map(async (f, i) => {
        const { width, height } = await extractDimensions(f.buffer, f.mimetype)
        const file = (uploaded as { id: string; url: string }[])[i]
        return {
          tenant_id: tenantId,
          file_id: file.id,
          url: file.url,
          original_filename: f.originalname,
          filename: f.originalname,
          mime_type: f.mimetype,
          size: f.size,
          width,
          height,
          checksum: checksumOf(f.buffer),
          alt,
          title,
          folder_id: folderId,
          created_by: createdBy,
        }
      })
    )

    created = await service.createCmsMedias(rows)
    created = Array.isArray(created) ? created : [created]
  } catch (e) {
    // Compensation: roll back stored bytes so storage never leaks orphans.
    try {
      await deleteFilesWorkflow(req.scope).run({ input: { ids: uploadedIds } })
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error(
        "[cms] failed to roll back uploaded files after media insert error:",
        cleanupErr
      )
    }
    throw e
  }

  // 3) Audit each created media row (best-effort, non-blocking).
  await Promise.all(
    created.map((m) =>
      recordMediaAudit(req, service, "media.upload", m.id, { after: m })
    )
  )

  res.status(201).json({ media: created })
}
