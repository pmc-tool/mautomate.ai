import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const productStatuses = ["draft", "published", "proposed", "rejected"] as const

const UpdateProductSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(productStatuses).optional(),
  prices: z.array(z.object({
    amount: z.number().int().min(0),
    currency_code: z.string().min(3).max(3).default("usd"),
  })).optional(),
  inventory_quantity: z.number().int().min(0).optional(),
  sku: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  collection_ids: z.array(z.string()).optional(),
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

async function loadVariantPrices(req: MedusaRequest, variantIds: string[]): Promise<Record<string, any[]>> {
  if (!variantIds.length) return {}
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_variant_price_set",
    filters: { variant_id: variantIds } as any,
    fields: ["variant_id", "price_set_id"],
  })
  const priceSetByVariant: Record<string, string> = {}
  for (const link of links || []) {
    const l = link as any
    if (l.variant_id && l.price_set_id) priceSetByVariant[l.variant_id] = l.price_set_id
  }

  const priceSetIds = Object.values(priceSetByVariant)
  if (!priceSetIds.length) return {}

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  const priceSets = await pricingModule.listPriceSets(
    { id: priceSetIds },
    { relations: ["prices"], take: priceSetIds.length }
  )
  const pricesByPriceSet = new Map<string, any[]>()
  for (const ps of priceSets || []) {
    pricesByPriceSet.set(ps.id, ps.prices || [])
  }

  const result: Record<string, any[]> = {}
  for (const [variantId, priceSetId] of Object.entries(priceSetByVariant)) {
    result[variantId] = pricesByPriceSet.get(priceSetId) || []
  }
  return result
}

async function loadProductDetail(productModule: any, productId: string) {
  return await productModule.retrieveProduct(productId, {
    relations: ["variants", "images", "tags", "collection"],
  })
}

async function enrichProductWithPrices(req: MedusaRequest, product: any): Promise<any> {
  const variants = product.variants || []
  const pricesByVariant = await loadVariantPrices(
    req,
    variants.map((v: any) => v.id)
  )
  product.variants = variants.map((v: any) => ({
    ...v,
    prices: pricesByVariant[v.id] || [],
  }))
  return product
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await loadProductDetail(productModule, id)
  await enrichProductWithPrices(req, product)
  res.json({ product })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const parsed = UpdateProductSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const {
    title, handle, description, status, prices, inventory_quantity, sku, tags, collection_ids,
  } = parsed.data

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await loadProductDetail(productModule, id)
  const variant = (product.variants || [])[0]

  // Resolve tag IDs from tag values (create missing ones).
  let tagIds: string[] | undefined
  if (tags !== undefined) {
    tagIds = []
    if (tags.length) {
      const existing = await productModule.listProductTags({ value: tags }, { take: tags.length })
      const existingByValue = new Map<string, string>((existing || []).map((t: any) => [t.value, t.id]))
      const missing = tags.filter((t) => !existingByValue.has(t))
      if (missing.length) {
        const created = await productModule.createProductTags(missing.map((value) => ({ value })))
        for (const t of created || []) existingByValue.set(t.value, t.id)
      }
      for (const t of tags) {
        const tagId = existingByValue.get(t)
        if (tagId) tagIds.push(tagId)
      }
    }
  }

  const productUpdate: any = { id }
  if (title !== undefined) productUpdate.title = title
  if (handle !== undefined) {
    productUpdate.handle = handle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
  }
  if (description !== undefined) productUpdate.description = description
  if (status !== undefined) productUpdate.status = status
  if (tagIds !== undefined) productUpdate.tag_ids = tagIds
  if (collection_ids !== undefined) productUpdate.collection_id = collection_ids[0] || null

  const variantUpdates: any[] = []
  if (variant && (prices !== undefined || inventory_quantity !== undefined || sku !== undefined)) {
    const variantUpdate: any = { id: variant.id }
    if (sku !== undefined) variantUpdate.sku = sku
    if (inventory_quantity !== undefined) {
      variantUpdate.metadata = {
        ...(variant.metadata || {}),
        inventory_quantity,
      }
    }
    if (prices !== undefined) {
      variantUpdate.prices = prices.map((p) => ({ amount: p.amount, currency_code: p.currency_code }))
    }
    variantUpdates.push(variantUpdate)
  }

  if (variantUpdates.length) {
    productUpdate.variants = variantUpdates
  }

  await updateProductsWorkflow(req.scope).run({
    input: { products: [productUpdate] },
  })

  const updated = await loadProductDetail(productModule, id)
  await enrichProductWithPrices(req, updated)
  res.json({ product: updated })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  await productModule.softDeleteProducts([id])
  res.status(204).send()
}
