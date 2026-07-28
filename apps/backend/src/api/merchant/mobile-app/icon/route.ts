import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import multer from "multer"
import { resolveMerchant } from "../../_helpers"
import { tenantScopedUploadFilename } from "../../../../lib/tenant-upload"

const upload = multer({ storage: multer.memoryStorage() })
const MAX_BYTES = 5 * 1024 * 1024

/**
 * POST /merchant/mobile-app/icon  (multipart field `file`)
 *
 * Upload the MOBILE APP icon. Dedicated endpoint (QA bug: the icon used to
 * ride POST /merchant/setup/logo, which writes tenant.meta.logo_url — so
 * setting an app icon silently replaced the STORE logo on the storefront).
 * This stores the file and records it ONLY on tenant.meta.app_config.icon_url;
 * store branding is untouched.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  await new Promise<void>((resolve, reject) => {
    upload.single("file")(req as any, res as any, (err: unknown) =>
      err ? reject(err) : resolve()
    )
  }).catch(() => undefined)

  const uploaded = (req as any).file as
    | { originalname: string; mimetype: string; buffer: Buffer; size: number }
    | undefined
  if (!uploaded) {
    return res.status(400).json({ message: "attach the icon as multipart field `file`" })
  }
  if (!/^image\//.test(uploaded.mimetype)) {
    return res.status(400).json({ message: "the icon must be an image" })
  }
  if (uploaded.size > MAX_BYTES) {
    return res.status(400).json({ message: "icon exceeds 5MB limit" })
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

    const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>) }
    meta.app_config = { ...(meta.app_config ?? {}), icon_url: file.url }
    await ctx.svc.updateTenants({ id: ctx.tenant.id, meta })

    res.status(201).json({ url: file.url })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "icon upload failed" })
  }
}
