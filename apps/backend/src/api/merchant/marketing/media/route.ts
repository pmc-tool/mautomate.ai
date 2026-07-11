import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"
import { tenantScopedUploadFilename } from "../../../../lib/tenant-upload"

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
]
const MAX_BYTES = 10 * 1024 * 1024

const kindForMime = (mime: string): "image" | "video" =>
  mime.startsWith("video/") ? "video" : "image"

/**
 * POST /merchant/marketing/media
 *
 * Upload a marketing post media asset for THIS merchant's tenant. Two modes:
 *  - multipart/form-data with field `file` → uploaded via the file module, then
 *    a tenant-scoped marketing_post_media row is created referencing it.
 *  - application/json { url, kind?, alt?, position?, post_id? } → registers an
 *    external asset by URL (no upload).
 *
 * When `post_id` is supplied it MUST belong to the caller's tenant (else 404),
 * and the media row is attached to it.
 *
 * Response: { media }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
  const b = (req.body ?? {}) as Record<string, any>

  try {
    // Optional post attachment — verify ownership up front (fail-closed).
    const postId =
      typeof b.post_id === "string" && b.post_id.trim() ? b.post_id.trim() : null
    if (postId) {
      const post = await (svc as any)
        .retrieveMarketingPost(postId)
        .catch(() => null)
      if (!post || post.tenant_id !== tenantId) {
        res.status(404).json({ message: `Post ${postId} was not found` })
        return
      }
    }

    const position = Number.isFinite(Number(b.position)) ? Number(b.position) : 0
    const alt = typeof b.alt === "string" ? b.alt : null

    const uploaded = (req as any).file as
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined

    let url: string | null = null
    let fileId: string | null = null
    let kind: "image" | "video"

    if (uploaded) {
      if (!ALLOWED_MIME_TYPES.includes(uploaded.mimetype)) {
        res
          .status(400)
          .json({ message: `invalid media type: ${uploaded.mimetype}` })
        return
      }
      if (uploaded.size > MAX_BYTES) {
        res.status(400).json({ message: "media exceeds 10MB limit" })
        return
      }

      const { result } = await uploadFilesWorkflow(req.scope).run({
        input: {
          files: [
            {
              filename: tenantScopedUploadFilename(
                tenantId,
                uploaded.originalname
              ),
              mimeType: uploaded.mimetype,
              content: uploaded.buffer.toString("base64"),
              access: "public" as const,
            },
          ],
        },
      })
      const file = (result as Array<{ id: string; url: string }>)[0]
      if (!file?.url) {
        res.status(500).json({ message: "upload failed" })
        return
      }
      url = file.url
      fileId = file.id ?? null
      kind = kindForMime(uploaded.mimetype)
    } else if (typeof b.url === "string" && b.url.trim()) {
      url = b.url.trim()
      kind = b.kind === "video" ? "video" : "image"
    } else {
      res.status(400).json({
        message:
          "Provide a multipart `file` upload or a JSON `url` to register media.",
      })
      return
    }

    const created = await (svc as any).createMarketingPostMedias({
      tenant_id: tenantId,
      post_id: postId,
      kind,
      file_id: fileId,
      url,
      alt,
      position,
    } as any)

    const media = Array.isArray(created) ? created[0] : created
    res.status(201).json({ media })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to upload media",
    })
  }
}
