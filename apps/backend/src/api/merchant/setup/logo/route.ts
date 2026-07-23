import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"
import { syncStoreLogoToCms } from "../../_cms-sync"
import { tenantScopedUploadFilename } from "../../../../lib/tenant-upload"

/**
 * POST /merchant/setup/logo
 *
 * Upload the store logo during setup. multipart/form-data with field `file`.
 * The file is stored tenant-namespaced (via tenantScopedUploadFilename, the
 * single source of truth for pooled upload keys), its URL is persisted to
 * tenant.meta.logo_url, and the URL is returned so the wizard can preview it.
 */

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
const MAX_BYTES = 5 * 1024 * 1024

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const uploaded = (req as any).file as
    | { buffer: Buffer; originalname: string; mimetype: string; size: number }
    | undefined
  if (!uploaded) return res.status(400).json({ message: "no file provided" })
  if (!ALLOWED.includes(uploaded.mimetype)) {
    return res.status(400).json({ message: `invalid logo type: ${uploaded.mimetype}` })
  }
  if (uploaded.size > MAX_BYTES) {
    return res.status(400).json({ message: "logo exceeds 5MB limit" })
  }

  try {
    const { result } = await uploadFilesWorkflow(req.scope).run({
      input: {
        files: [
          {
            filename: tenantScopedUploadFilename(ctx.tenant.id, uploaded.originalname),
            mimeType: uploaded.mimetype,
            content: uploaded.buffer.toString("base64"),
            access: "public" as const,
          },
        ],
      },
    })
    const file = (result as Array<{ id: string; url: string }>)[0]
    if (!file?.url) return res.status(500).json({ message: "upload failed" })

    const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>), logo_url: file.url }
    await ctx.svc.updateTenants({ id: ctx.tenant.id, meta })

    // Mirror into the CMS settings the storefront chrome actually renders.
    await syncStoreLogoToCms(req.scope, ctx.tenant.id, file.url)

    res.status(201).json({ url: file.url })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "logo upload failed" })
  }
}
