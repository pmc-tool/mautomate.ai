import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"
import { tenantScopedUploadFilename } from "../../../../../lib/tenant-upload"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 10 * 1024 * 1024

async function productBelongsToSalesChannel(
  req: MedusaRequest,
  productId: string,
  scId: string
): Promise<boolean> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId, product_id: productId } as any,
    fields: ["product_id"],
  })
  return (links || []).length > 0
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const uploadedFile = (req as any).file as {
    buffer: Buffer
    originalname: string
    mimetype: string
    size: number
  } | undefined

  if (!uploadedFile) {
    return res.status(400).json({ message: "image file is required (field name: image)" })
  }

  if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
    return res.status(400).json({ message: `invalid image type: ${uploadedFile.mimetype}` })
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

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await productModule.retrieveProduct(id, { relations: ["images"] })
  const existingImages = (product.images || []).map((img: any) => ({ id: img.id }))

  await productModule.updateProducts(id, {
    thumbnail: file.url,
    images: [...existingImages, { url: file.url }],
  })

  res.status(201).json({ product: { id, thumbnail: file.url, url: file.url } })
}
