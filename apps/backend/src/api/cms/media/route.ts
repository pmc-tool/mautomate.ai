import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  uploadFilesWorkflow,
  deleteFilesWorkflow,
} from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../modules/cms"
import { cmsTenantId, requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"
import {
  assertAllowedMime,
  checksumOf,
  extractDimensions,
  MAX_UPLOAD_BYTES,
  tenantScopedUploadFilename,
} from "../../admin/cms/media/_helpers"

/**
 * Secret-gated Media Library bridge for the visual editor.
 *
 * The visual editor runs on the storefront gated by a `?key=` (not admin
 * auth), so it cannot reach the admin-auth-gated /admin/cms/media routes.
 * This route mirrors that logic behind the same server-to-server secret the
 * visual-settings / visual-publish bridges use (`x-cms-secret` ===
 * CMS_REVALIDATE_SECRET, timing-safe compare). Only the storefront proxy
 * (which itself validates the editor key) ever calls it.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

function assertSecret(req: MedusaRequest): void {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (
    !expected ||
    typeof provided !== "string" ||
    !safeEqual(provided, expected)
  ) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
}

/**
 * GET /cms/media  (secret-gated)
 * List image media (newest first). Query: q (filename contains),
 * limit (default 50, max 200), offset (default 0).
 * Response: { media, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  assertSecret(req)

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: scope to the store behind the editor. Fail-closed.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ media: [], count: 0 })
    return
  }

  const q = (req.query.q as string | undefined)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  const filters: Record<string, any> = {
    tenant_id: tenantId,
    mime_type: { $ilike: "image/%" },
  }
  if (q) {
    filters.original_filename = { $ilike: `%${q}%` }
  }

  const [media, count] = await service.listAndCountCmsMedias(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.json({ media, count })
}

/**
 * POST /cms/media  (secret-gated, application/json)
 * Upload a single file. Body: { filename, mimeType, contentBase64 }.
 * Stores the bytes via the File Module (the same uploadFilesWorkflow the admin
 * route uses) then writes one cms_media catalog row. created_by is null (no
 * admin actor in this bridge). Response: 201 { media }.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  assertSecret(req)

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Trusted storefront proxy asserts the tenant (secret-gated). Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const body = (req.body ?? {}) as {
    filename?: string
    mimeType?: string
    contentBase64?: string
  }
  const filename = body.filename
  const mimeType = body.mimeType
  const contentBase64 = body.contentBase64

  if (!filename || !mimeType || !contentBase64) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`filename`, `mimeType` and `contentBase64` are required."
    )
  }

  assertAllowedMime(mimeType)

  const buffer = Buffer.from(contentBase64, "base64")
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `File "${filename}" exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`
    )
  }

  // 1) Store bytes via the File Module (reuses the built-in upload workflow).
  const { result: uploaded } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: tenantScopedUploadFilename(tenantId, filename),
          mimeType,
          content: contentBase64,
          access: "public" as const,
        },
      ],
    },
  })

  const file = (uploaded as { id: string; url: string }[])[0]

  // 2) Build the catalog row (with dimensions + checksum).
  let created: any
  try {
    const { width, height } = await extractDimensions(buffer, mimeType)
    created = await service.createCmsMedias({
      tenant_id: tenantId,
      file_id: file.id,
      url: file.url,
      original_filename: filename,
      filename,
      mime_type: mimeType,
      size: buffer.length,
      width,
      height,
      checksum: checksumOf(buffer),
      alt: null,
      title: null,
      folder_id: null,
      created_by: null,
    })
    created = Array.isArray(created) ? created[0] : created
  } catch (e) {
    // Compensation: roll back stored bytes so storage never leaks orphans.
    try {
      await deleteFilesWorkflow(req.scope).run({ input: { ids: [file.id] } })
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error(
        "[cms] failed to roll back uploaded file after media insert error:",
        cleanupErr
      )
    }
    throw e
  }

  res.status(201).json({ media: created })
}
