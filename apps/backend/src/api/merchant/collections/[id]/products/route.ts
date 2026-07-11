import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const ProductIdsSchema = z.object({
  product_ids: z.array(z.string()).min(1),
})

/**
 * Retrieve a collection only if it belongs to this tenant (metadata.tenant_id).
 * Null-safe `!==` guard: untagged collections never match a real tenant id.
 */
async function findOwnedCollection(
  req: MedusaRequest,
  tenantId: string,
  id: string
) {
  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const collection = await productModule
    .retrieveProductCollection(id)
    .catch(() => null)
  if (!collection || collection.metadata?.tenant_id !== tenantId) return null
  return collection
}

/**
 * True only if EVERY productId is linked to the tenant's sales channel. Used to
 * reject cross-tenant product mutations before running updateProductsWorkflow —
 * without this a tenant could pull another tenant's product into a collection.
 */
async function allProductsInSalesChannel(
  req: MedusaRequest,
  productIds: string[],
  scId: string
): Promise<boolean> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId, product_id: productIds } as any,
    fields: ["product_id"],
  })
  const owned = new Set((links || []).map((l: any) => l.product_id).filter(Boolean))
  return productIds.every((pid) => owned.has(pid))
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

/**
 * GET /merchant/collections/:id/products
 *
 * Products currently in this collection.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ products: [], count: 0 })

  const { id } = req.params
  const collection = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!collection) return res.status(404).json({ message: "collection not found" })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)

  const { data: scLinks } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const scProductIds = new Set((scLinks || []).map((l: any) => l.product_id).filter(Boolean))

  const products = await productModule.listProducts(
    { collection_id: id },
    { take: 200, relations: ["variants"] }
  )

  const tenantProducts = (products || []).filter((p: any) => scProductIds.has(p.id))
  const allVariantIds = tenantProducts
    .flatMap((p: any) => (p.variants || []).map((v: any) => v.id))
    .filter(Boolean)
  const pricesByVariant = await loadVariantPrices(req, allVariantIds)

  const serialized = tenantProducts.map((p: any) => {
    const firstVariant = (p.variants || [])[0]
    const firstPrice = firstVariant ? pricesByVariant[firstVariant.id]?.[0] : undefined
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      thumbnail: p.thumbnail,
      variant_count: (p.variants || []).length,
      price: firstPrice?.amount,
      currency_code: firstPrice?.currency_code,
    }
  })

  res.json({ products: serialized, count: serialized.length })
}

/**
 * POST /merchant/collections/:id/products
 *
 * Add products to the collection. The collection must be owned by this tenant
 * and EVERY product must belong to this tenant's sales channel — otherwise the
 * whole request is rejected before any product is mutated.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const parsed = ProductIdsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const { product_ids } = parsed.data

  const collection = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!collection) return res.status(404).json({ message: "collection not found" })

  if (!(await allProductsInSalesChannel(req, product_ids, scId))) {
    return res.status(404).json({ message: "one or more products not found" })
  }

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: product_ids.map((productId) => ({ id: productId, collection_id: id })),
    },
  })

  res.status(200).json({ success: true, collection_id: id, product_ids })
}

/**
 * DELETE /merchant/collections/:id/products
 *
 * Remove products from the collection. Same ownership + sales-channel checks as
 * POST so a tenant can never mutate another tenant's product.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const parsed = ProductIdsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const { product_ids } = parsed.data

  const collection = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!collection) return res.status(404).json({ message: "collection not found" })

  if (!(await allProductsInSalesChannel(req, product_ids, scId))) {
    return res.status(404).json({ message: "one or more products not found" })
  }

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: product_ids.map((productId) => ({ id: productId, collection_id: null })),
    },
  })

  res.status(200).json({ success: true, collection_id: id, product_ids })
}
