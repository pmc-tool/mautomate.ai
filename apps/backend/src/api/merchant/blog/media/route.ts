import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"
import { tenantScopedUploadFilename } from "../../../../lib/tenant-upload"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 10 * 1024 * 1024

/**
 * POST /merchant/blog/media
 * Upload a blog image (cover / inline content image) for the merchant's store.
 * Multipart field name: `file`. The stored file key is namespaced per tenant
 * (tenantScopedUploadFilename) so stores can never collide or guess each
 * other's assets. Response: { url, file_id }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const uploadedFile = (req as any).file as
    | {
        buffer: Buffer
        originalname: string
        mimetype: string
        size: number
      }
    | undefined

  if (!uploadedFile) {
    return res
      .status(400)
      .json({ message: "image file is required (field name: file)" })
  }

  if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
    return res
      .status(400)
      .json({ message: `invalid image type: ${uploadedFile.mimetype}` })
  }
  if (uploadedFile.size > MAX_BYTES) {
    return res.status(400).json({ message: "image exceeds 10MB limit" })
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: tenantScopedUploadFilename(
            ctx.tenant.id,
            uploadedFile.originalname
          ),
          mimeType: uploadedFile.mimetype,
          content: uploadedFile.buffer.toString("base64"),
          access: "public" as const,
        },
      ],
    },
  })

  const file = (result as Array<{ id: string; url: string }>)[0]
  if (!file?.url) {
    return res.status(500).json({ message: "upload failed" })
  }

  res.status(201).json({ url: file.url, file_id: file.id })
}
