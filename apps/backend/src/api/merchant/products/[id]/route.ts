import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import {
  getAvailableByVariant,
  getVariantInventoryLinks,
  getOrCreateDefaultLocation,
  setStockLevel,
} from "../../_inventory"

const productStatuses = ["draft", "published", "proposed", "rejected"] as const

const PriceSchema = z.object({
  amount: z.number().min(0),
  currency_code: z.string().min(3).max(3).default("usd"),
})

const UpdateProductSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  handle: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(productStatuses).optional(),
  discountable: z.boolean().optional(),
  // Attributes
  weight: z.number().nullable().optional(),
  length: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  mid_code: z.string().nullable().optional(),
  hs_code: z.string().nullable().optional(),
  origin_country: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  // Media
  thumbnail: z.string().nullable().optional(),
  images: z
    .array(z.object({ id: z.string().optional(), url: z.string().min(1) }))
    .optional(),
  // Organize
  collection_id: z.string().nullable().optional(),
  type_id: z.string().nullable().optional(),
  tag_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  shipping_profile_id: z.string().nullable().optional(),
  // Legacy fields kept for backward compatibility with existing clients.
  prices: z.array(PriceSchema).optional(),
  inventory_quantity: z.number().int().min(0).optional(),
  sku: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  collection_ids: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        prices: z.array(PriceSchema).optional(),
        inventory_quantity: z.number().int().min(0).optional(),
        sku: z.string().optional().nullable(),
        manage_inventory: z.boolean().optional(),
        allow_backorder: z.boolean().optional(),
      })
    )
    .optional(),
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
    relations: ["variants", "variants.options", "options", "options.values", "images", "tags", "collection", "categories"],
  })
}

async function enrichProductWithPrices(req: MedusaRequest, product: any): Promise<any> {
  const variants = product.variants || []
  const variantIds = variants.map((v: any) => v.id)
  const pricesByVariant = await loadVariantPrices(req, variantIds)
  // REAL available stock per variant (inventory levels), legacy metadata fallback.
  const availableByVariant = await getAvailableByVariant(req, variantIds)
  product.variants = variants.map((v: any) => ({
    ...v,
    prices: pricesByVariant[v.id] || [],
    inventory_quantity:
      v.id in availableByVariant
        ? availableByVariant[v.id]
        : v.metadata?.inventory_quantity ?? 0,
  }))
  return product
}

// Fields for the full detail response (contract: getProductFull).
const FULL_FIELDS = [
  "id",
  "title",
  "subtitle",
  "handle",
  "description",
  "status",
  "thumbnail",
  "weight",
  "length",
  "height",
  "width",
  "mid_code",
  "hs_code",
  "origin_country",
  "material",
  "discountable",
  "external_id",
  "metadata",
  "created_at",
  "updated_at",
  "images.id",
  "images.url",
  "images.rank",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "options.values.rank",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.ean",
  "variants.upc",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.variant_rank",
  "variants.metadata",
  "variants.created_at",
  "variants.updated_at",
  "variants.options.id",
  "variants.options.value",
  "variants.options.option.id",
  "variants.options.option.title",
  "collection.id",
  "collection.title",
  "categories.id",
  "categories.name",
  "type.id",
  "type.value",
  "tags.id",
  "tags.value",
  "sales_channels.id",
  "sales_channels.name",
  "shipping_profile.id",
  "shipping_profile.name",
]

/** Full product detail per the getProductFull contract, or null when missing. */
async function buildFullProduct(req: MedusaRequest, productId: string): Promise<any | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productId } as any,
    fields: FULL_FIELDS,
  })
  const product = (data || [])[0]
  if (!product) return null

  const variants = product.variants || []
  const variantIds = variants.map((v: any) => v.id)
  const pricesByVariant = await loadVariantPrices(req, variantIds)
  const availableByVariant = await getAvailableByVariant(req, variantIds)

  product.variants = variants
    .map((v: any) => ({
      ...v,
      prices: (pricesByVariant[v.id] || [])
        .filter((p: any) => !p.price_list_id)
        .map((p: any) => ({
          id: p.id,
          currency_code: p.currency_code,
          amount: p.amount,
        })),
      inventory_quantity:
        v.id in availableByVariant
          ? availableByVariant[v.id]
          : v.metadata?.inventory_quantity ?? 0,
    }))
    .sort((a: any, b: any) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0))

  product.options = (product.options || []).map((o: any) => ({
    ...o,
    values: [...(o.values || [])].sort(
      (a: any, b: any) =>
        (a.rank ?? 0) - (b.rank ?? 0) ||
        String(a.value).localeCompare(String(b.value))
    ),
  }))

  product.images = [...(product.images || [])].sort(
    (a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0)
  )

  return product
}

function wantsFull(req: MedusaRequest): boolean {
  const raw = req.query.full
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === "1" || value === "true"
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

  if (wantsFull(req)) {
    const product = await buildFullProduct(req, id)
    if (!product) return res.status(404).json({ message: "product not found" })
    return res.json({ product })
  }

  // Legacy shape (kept for pre-parity consumers without ?full=1).
  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await loadProductDetail(productModule, id)
  await enrichProductWithPrices(req, product)
  res.json({ product })
}

const handleUpdate = async (req: MedusaRequest, res: MedusaResponse) => {
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

  const d = parsed.data

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const product = await loadProductDetail(productModule, id)
  const firstVariant = (product.variants || [])[0]

  // Resolve tag ids. Explicit tag_ids (new contract) win over the legacy
  // `tags` value list (resolved and created by value; implicitly-created tags
  // carry metadata.tenant_id so the tenant-scoped filter sees them).
  let tagIds: string[] | undefined
  if (d.tag_ids !== undefined) {
    tagIds = d.tag_ids
  } else if (d.tags !== undefined) {
    tagIds = []
    if (d.tags.length) {
      const existing = await productModule.listProductTags({ value: d.tags }, { take: d.tags.length })
      const existingByValue = new Map<string, string>((existing || []).map((t: any) => [t.value, t.id]))
      const missing = d.tags.filter((t) => !existingByValue.has(t))
      if (missing.length) {
        const created = await productModule.createProductTags(
          missing.map((value) => ({ value, metadata: { tenant_id: ctx.tenant.id } }))
        )
        for (const t of created || []) existingByValue.set(t.value, t.id)
      }
      for (const t of d.tags) {
        const tagId = existingByValue.get(t)
        if (tagId) tagIds.push(tagId)
      }
    }
  }

  const productUpdate: any = { id }
  if (d.title !== undefined) productUpdate.title = d.title
  if (d.subtitle !== undefined) productUpdate.subtitle = d.subtitle
  if (d.handle !== undefined) {
    productUpdate.handle = d.handle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
  }
  if (d.description !== undefined) productUpdate.description = d.description
  if (d.status !== undefined) productUpdate.status = d.status
  if (d.discountable !== undefined) productUpdate.discountable = d.discountable
  if (d.weight !== undefined) productUpdate.weight = d.weight
  if (d.length !== undefined) productUpdate.length = d.length
  if (d.height !== undefined) productUpdate.height = d.height
  if (d.width !== undefined) productUpdate.width = d.width
  if (d.mid_code !== undefined) productUpdate.mid_code = d.mid_code
  if (d.hs_code !== undefined) productUpdate.hs_code = d.hs_code
  if (d.origin_country !== undefined) productUpdate.origin_country = d.origin_country
  if (d.material !== undefined) productUpdate.material = d.material
  if (d.external_id !== undefined) productUpdate.external_id = d.external_id
  if (d.metadata !== undefined) productUpdate.metadata = d.metadata
  if (d.thumbnail !== undefined) productUpdate.thumbnail = d.thumbnail
  if (d.images !== undefined) productUpdate.images = d.images
  if (d.type_id !== undefined) productUpdate.type_id = d.type_id
  if (d.shipping_profile_id !== undefined) productUpdate.shipping_profile_id = d.shipping_profile_id
  if (tagIds !== undefined) productUpdate.tag_ids = tagIds
  if (d.collection_id !== undefined) {
    productUpdate.collection_id = d.collection_id
  } else if (d.collection_ids !== undefined) {
    productUpdate.collection_id = d.collection_ids[0] || null
  }
  if (d.category_ids !== undefined) {
    productUpdate.categories = d.category_ids.length ? d.category_ids.map((cid) => ({ id: cid })) : []
  }

  // Pending REAL stock-level changes, applied after the product update so the
  // inventory item exists. { variantId, qty }
  const pendingStock: { variantId: string; qty: number }[] = []

  const variantUpdates: any[] = []
  if (d.variants && d.variants.length) {
    for (const v of d.variants) {
      const existing = (product.variants || []).find((ev: any) => ev.id === v.id)
      if (!existing) continue
      const variantUpdate: any = { id: v.id }
      if (v.sku !== undefined) variantUpdate.sku = v.sku
      if (v.manage_inventory !== undefined) variantUpdate.manage_inventory = v.manage_inventory
      if (v.allow_backorder !== undefined) variantUpdate.allow_backorder = v.allow_backorder
      if (v.inventory_quantity !== undefined) {
        // Real inventory: ensure the variant manages inventory, then set a level.
        variantUpdate.manage_inventory = true
        pendingStock.push({ variantId: v.id, qty: v.inventory_quantity })
      }
      if (v.prices !== undefined) {
        variantUpdate.prices = v.prices.map((p) => ({ amount: p.amount, currency_code: p.currency_code }))
      }
      variantUpdates.push(variantUpdate)
    }
  } else if (firstVariant && (d.prices !== undefined || d.inventory_quantity !== undefined || d.sku !== undefined)) {
    const variantUpdate: any = { id: firstVariant.id }
    if (d.sku !== undefined) variantUpdate.sku = d.sku
    if (d.inventory_quantity !== undefined) {
      variantUpdate.manage_inventory = true
      pendingStock.push({ variantId: firstVariant.id, qty: d.inventory_quantity })
    }
    if (d.prices !== undefined) {
      variantUpdate.prices = d.prices.map((p) => ({ amount: p.amount, currency_code: p.currency_code }))
    }
    variantUpdates.push(variantUpdate)
  }

  if (variantUpdates.length) {
    productUpdate.variants = variantUpdates
  }

  try {
    await updateProductsWorkflow(req.scope).run({
      input: { products: [productUpdate] },
    })
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to update product" })
  }

  // Apply REAL stock levels at the tenant's default location. Skip gracefully
  // if no location is available.
  let inventory_note: string | undefined
  if (pendingStock.length) {
    try {
      const variantIds = pendingStock.map((p) => p.variantId)
      const { variantToItem } = await getVariantInventoryLinks(req, variantIds)
      const locationId = await getOrCreateDefaultLocation(req, ctx)
      if (!locationId) {
        inventory_note = "no stock location available; stock levels not set"
      } else {
        for (const p of pendingStock) {
          const itemId = variantToItem[p.variantId]
          if (!itemId) continue
          await setStockLevel(req, itemId, locationId, p.qty)
        }
      }
    } catch (e: any) {
      inventory_note = `inventory level update skipped: ${e?.message || "unknown error"}`
    }
  }

  if (wantsFull(req)) {
    const full = await buildFullProduct(req, id)
    if (!full) return res.status(404).json({ message: "product not found" })
    return res.json({ product: full, ...(inventory_note ? { inventory_note } : {}) })
  }

  const updated = await loadProductDetail(productModule, id)
  await enrichProductWithPrices(req, updated)
  res.json({ product: updated, ...(inventory_note ? { inventory_note } : {}) })
}

// The dashboard api client updates via PUT; the parity contract posts to the
// same path. Both verbs share one handler.
export const PUT = handleUpdate
export const POST = handleUpdate

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
