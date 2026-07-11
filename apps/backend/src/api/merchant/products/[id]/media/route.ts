import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow, uploadFilesWorkflow } from "@medusajs/core-flows"
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

/**
 * DELETE /merchant/products/[id]/media?image_id=img_...
 *
 * Remove one image from the tenant-owned product's images. When the product
 * thumbnail pointed at the removed image's url, the thumbnail is cleared too.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const imageId = typeof req.query?.image_id === "string" ? req.query.image_id : ""
  if (!imageId) {
    return res.status(400).json({ message: "image_id query parameter is required" })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  let product: any
  try {
    product = await productModule.retrieveProduct(id, { relations: ["images"] })
  } catch {
    return res.status(404).json({ message: "product not found" })
  }

  const images: any[] = product.images || []
  const removed = images.find((img) => img.id === imageId)
  if (!removed) {
    return res.status(404).json({ message: "image not found" })
  }

  const remaining = images.filter((img) => img.id !== imageId)
  const update: any = {
    id,
    images: remaining.map((img) => ({ id: img.id, url: img.url })),
  }
  if (product.thumbnail && product.thumbnail === removed.url) {
    update.thumbnail = null
  }

  try {
    await updateProductsWorkflow(req.scope).run({
      input: { products: [update] },
    })
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to remove image" })
  }

  const fresh = await productModule.retrieveProduct(id, { relations: ["images"] })
  res.json({
    product: {
      id: fresh.id,
      thumbnail: fresh.thumbnail ?? null,
      images: (fresh.images || []).map((img: any) => ({ id: img.id, url: img.url })),
    },
  })
}
