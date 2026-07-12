import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { batchLinkProductsToCategoryWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const BatchSchema = z.object({
  add: z.array(z.string()).optional().default([]),
  remove: z.array(z.string()).optional().default([]),
})

/**
 * Fetch a category's ownership tag via query.graph — the module-service
 * retrieve omits metadata. Returns null unless the row belongs to this tenant.
 */
async function findOwnedCategory(
  req: MedusaRequest,
  tenantId: string,
  id: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "metadata"],
    filters: { id } as any,
  })
  const category = (data || [])[0]
  if (!category || category.metadata?.tenant_id !== tenantId) return null
  return category
}

/**
 * True only if EVERY productId is linked to the tenant's sales channel. Used to
 * reject cross-tenant product mutations before running the link workflow — a
 * tenant must never pull another tenant's product into their category.
 */
async function allProductsInSalesChannel(
  req: MedusaRequest,
  productIds: string[],
  scId: string
): Promise<boolean> {
  if (!productIds.length) return true
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId, product_id: productIds } as any,
    fields: ["product_id"],
  })
  const owned = new Set(
    (links || []).map((l: any) => l.product_id).filter(Boolean)
  )
  return productIds.every((pid) => owned.has(pid))
}

function serializeRow(p: any) {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    thumbnail: p.thumbnail ?? null,
    collection: p.collection
      ? { id: p.collection.id, title: p.collection.title }
      : null,
    variants_count: (p.variants || []).length,
    sales_channels: (p.sales_channels || []).map((sc: any) => ({
      id: sc.id,
      name: sc.name,
    })),
  }
}

/**
 * GET /merchant/product-categories/:id/products
 *
 * Products in the category, restricted to this tenant's sales channel. Supports
 * q (title/handle search), offset and limit.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ products: [], count: 0 })

  const { id } = req.params
  const category = await findOwnedCategory(req, ctx.tenant.id, id)
  if (!category) return res.status(404).json({ message: "product category not found" })

  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : ""
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0)
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10)
  )

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: scLinks } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const scProductIds = new Set(
    (scLinks || []).map((l: any) => l.product_id).filter(Boolean)
  )

  // Product.category_id is not filterable in this Medusa version (probe-proven).
  // Walk from the category side instead: product_category.products.
  const { data: catData } = await query.graph({
    entity: "product_category",
    filters: { id } as any,
    fields: [
      "id",
      "products.id",
      "products.title",
      "products.handle",
      "products.thumbnail",
      "products.status",
      "products.variants.id",
      "products.collection.id",
      "products.collection.title",
    ],
  })
  const products = (catData?.[0] as any)?.products || []

  let tenantProducts = (products || []).filter((p: any) =>
    scProductIds.has(p.id)
  )
  if (q) {
    tenantProducts = tenantProducts.filter(
      (p: any) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.handle || "").toLowerCase().includes(q)
    )
  }
  tenantProducts.sort((a: any, b: any) =>
    (a.title || "").localeCompare(b.title || "")
  )

  const count = tenantProducts.length
  const page = tenantProducts.slice(offset, offset + limit)

  res.json({ products: page.map(serializeRow), count })
}

/**
 * POST /merchant/product-categories/:id/products
 *
 * Add and/or remove products from the category in one batch. The category must
 * be owned by this tenant and EVERY product (add or remove) must belong to this
 * tenant's sales channel — otherwise the whole request is rejected before any
 * link is mutated.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) {
    return res.status(400).json({ message: "tenant sales channel not configured" })
  }

  const parsed = BatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const { add, remove } = parsed.data

  const category = await findOwnedCategory(req, ctx.tenant.id, id)
  if (!category) return res.status(404).json({ message: "product category not found" })

  const touched = Array.from(new Set([...add, ...remove]))
  if (!(await allProductsInSalesChannel(req, touched, scId))) {
    return res.status(404).json({ message: "one or more products not found" })
  }

  await batchLinkProductsToCategoryWorkflow(req.scope).run({
    input: { id, add, remove },
  })

  res.status(200).json({ success: true, category_id: id, add, remove })
}
