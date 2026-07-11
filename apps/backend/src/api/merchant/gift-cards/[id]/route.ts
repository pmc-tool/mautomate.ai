import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const productStatuses = ["draft", "published", "proposed", "rejected"] as const

const UpdateGiftCardSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(productStatuses).optional(),
  prices: z.array(z.object({
    amount: z.number().min(0),
    currency_code: z.string().min(3).max(3).default("usd"),
  })).min(1).optional(),
  sku: z.string().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
})

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

function formatGiftCard(product: any) {
  const variant = (product.variants || [])[0]
  const price = (variant?.prices || [])[0]
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: product.status,
    thumbnail: product.thumbnail,
    price: price?.amount ?? null,
    currency_code: price?.currency_code ?? null,
    sku: variant?.sku ?? null,
    created_at: product.created_at,
    updated_at: product.updated_at,
  }
}

/**
 * GET /merchant/gift-cards/:id
 *
 * Gift cards ARE products: the id must belong to this tenant's sales channel,
 * otherwise 404 (prevents cross-tenant gift-card reads).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "gift card not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "gift card not found" })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await productModule.retrieveProduct(id, {
    relations: ["variants.prices"],
  }).catch(() => null)

  if (!product || !product.is_giftcard) {
    return res.status(404).json({ message: "gift card not found" })
  }

  res.json({ gift_card: formatGiftCard(product) })
}

/**
 * PUT /merchant/gift-cards/:id
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "gift card not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "gift card not found" })
  }

  const parsed = UpdateGiftCardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await productModule.retrieveProduct(id, {
    relations: ["variants"],
  }).catch(() => null)
  if (!product || !product.is_giftcard) {
    return res.status(404).json({ message: "gift card not found" })
  }

  const variant = (product.variants || [])[0]
  const variantId = variant?.id

  const productUpdate: any = { id }
  if (parsed.data.title !== undefined) productUpdate.title = parsed.data.title
  if (parsed.data.handle !== undefined) productUpdate.handle = parsed.data.handle
  if (parsed.data.description !== undefined) productUpdate.description = parsed.data.description
  if (parsed.data.status !== undefined) productUpdate.status = parsed.data.status
  if (parsed.data.thumbnail !== undefined) productUpdate.thumbnail = parsed.data.thumbnail

  const variantsUpdate: any[] = []
  if (variantId && (parsed.data.prices !== undefined || parsed.data.sku !== undefined)) {
    const vUpdate: any = { id: variantId }
    if (parsed.data.prices !== undefined) vUpdate.prices = parsed.data.prices
    if (parsed.data.sku !== undefined) vUpdate.sku = parsed.data.sku
    variantsUpdate.push(vUpdate)
  }

  const { result: products } = await updateProductsWorkflow(req.scope).run({
    input: { products: [{ ...productUpdate, variants: variantsUpdate.length ? variantsUpdate : undefined }] },
  })

  res.json({ gift_card: formatGiftCard((products as any[])[0]) })
}

/**
 * DELETE /merchant/gift-cards/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "gift card not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "gift card not found" })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await productModule.retrieveProduct(id).catch(() => null)
  if (!product || !product.is_giftcard) {
    return res.status(404).json({ message: "gift card not found" })
  }

  await productModule.deleteProducts([id])
  res.status(204).send()
}
