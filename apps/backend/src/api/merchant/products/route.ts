import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import {
  getAvailableByVariant,
  getVariantInventoryLinks,
  getOrCreateDefaultLocation,
  setStockLevel,
} from "../_inventory"

const productStatuses = ["draft", "published", "proposed", "rejected"] as const

const PriceSchema = z.object({
  amount: z.number().min(0),
  currency_code: z.string().min(3).max(3).default("usd"),
})

const CreateVariantSchema = z.object({
  title: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  ean: z.string().optional(),
  upc: z.string().optional(),
  prices: z.array(PriceSchema).optional().default([]),
  inventory_quantity: z.number().int().min(0).optional().default(0),
  allow_backorder: z.boolean().optional().default(false),
  // Default true so Medusa creates a REAL inventory item per variant. An
  // explicit false is honored (no inventory item stock level is written).
  manage_inventory: z.boolean().optional().default(true),
  options: z.record(z.string(), z.string()).optional().default({}),
})

const CreateProductSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  handle: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(productStatuses).optional().default("draft"),
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
  metadata: z.record(z.string(), z.any()).optional(),
  // Media
  thumbnail: z.string().nullable().optional(),
  images: z.array(z.object({ url: z.string().min(1) })).optional(),
  // Organize
  collection_id: z.string().nullable().optional(),
  type_id: z.string().nullable().optional(),
  tag_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional().default([]),
  shipping_profile_id: z.string().optional(),
  // Legacy aliases kept for backward compatibility with existing clients.
  tags: z.array(z.string()).optional().default([]),
  collection_ids: z.array(z.string()).optional().default([]),
  prices: z
    .array(PriceSchema)
    .optional()
    .default([{ amount: 0, currency_code: "usd" }]),
  inventory_quantity: z.number().int().min(0).optional().default(0),
  sku: z.string().optional(),
  // Options + variants
  options: z
    .array(
      z.object({
        title: z.string().min(1),
        values: z.array(z.string().min(1)).min(1),
      })
    )
    .optional()
    .default([]),
  variants: z.array(CreateVariantSchema).optional().default([]),
})

function slugifyHandle(title: string, existing?: string): string {
  if (existing) return existing.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
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

// Fields for the paged product list (contract: listProductsPaged).
const LIST_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "thumbnail",
  "created_at",
  "updated_at",
  "collection.id",
  "collection.title",
  "type.id",
  "type.value",
  "tags.id",
  "tags.value",
  "sales_channels.id",
  "sales_channels.name",
  "variants.id",
  "variants.metadata",
  "metadata",
]

const ORDERABLE_FIELDS = new Set(["title", "created_at", "updated_at"])

/** Accepts repeated params and comma-separated lists: ?status=a,b&status=c */
function toList(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((v) => String(v).split(","))
    .map((s) => s.trim())
    .filter(Boolean)
}

function firstParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const str = String(raw)
  return str.length ? str : undefined
}

function parseNonNegativeInt(value: unknown, fallback: number): number | null {
  const raw = firstParam(value)
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ products: [], count: 0 })

  const offset = parseNonNegativeInt(req.query.offset, 0)
  const limit = parseNonNegativeInt(req.query.limit, 20)
  if (offset === null) {
    return res.status(400).json({ message: "invalid offset" })
  }
  if (limit === null || limit < 1 || limit > 100) {
    return res.status(400).json({ message: "invalid limit (1-100)" })
  }

  const statuses = toList(req.query.status)
  const invalidStatus = statuses.find(
    (s) => !(productStatuses as readonly string[]).includes(s)
  )
  if (invalidStatus) {
    return res.status(400).json({ message: `invalid status: ${invalidStatus}` })
  }

  let order: Record<string, "ASC" | "DESC"> = { created_at: "DESC" }
  const rawOrder = firstParam(req.query.order)
  if (rawOrder) {
    const desc = rawOrder.startsWith("-")
    const field = desc ? rawOrder.slice(1) : rawOrder
    if (!ORDERABLE_FIELDS.has(field)) {
      return res.status(400).json({ message: `invalid order field: ${field}` })
    }
    order = { [field]: desc ? "DESC" : "ASC" }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Tenant scoping: only products linked to THIS tenant's sales channel.
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return res.json({ products: [], count: 0 })

  const filters: any = { id: ids }
  const q = firstParam(req.query.q)
  if (q) filters.q = q
  if (statuses.length) filters.status = statuses
  const typeIds = toList(req.query.type_id)
  if (typeIds.length) filters.type_id = typeIds
  const collectionIds = toList(req.query.collection_id)
  if (collectionIds.length) filters.collection_id = collectionIds
  const tagIds = toList(req.query.tag_id)
  if (tagIds.length) filters.tags = { id: tagIds }
  const categoryIds = toList(req.query.category_id)
  if (categoryIds.length) filters.categories = { id: categoryIds }

  const { data, metadata } = await query.graph({
    entity: "product",
    filters,
    fields: LIST_FIELDS,
    pagination: { take: limit, skip: offset, order } as any,
  })

  const rows = data || []

  // Legacy price/stock enrichment (first variant only) so pre-parity consumers
  // of GET /merchant/products keep working. Failures here never break the list.
  const firstVariantIds = rows
    .map((p: any) => p.variants?.[0]?.id)
    .filter(Boolean)
  let pricesByVariant: Record<string, any[]> = {}
  let availableByVariant: Record<string, number> = {}
  try {
    pricesByVariant = await loadVariantPrices(req, firstVariantIds)
    availableByVariant = await getAvailableByVariant(req, firstVariantIds)
  } catch {
    pricesByVariant = {}
    availableByVariant = {}
  }

  const products = rows.map((p: any) => {
    const variants = p.variants || []
    const firstVariant = variants[0]
    const variantPrices = firstVariant ? pricesByVariant[firstVariant.id] || [] : []
    const firstPrice =
      variantPrices.find((pr: any) => !pr.price_list_id) ?? variantPrices[0]
    let stock = 0
    if (firstVariant) {
      stock =
        firstVariant.id in availableByVariant
          ? availableByVariant[firstVariant.id]
          : firstVariant.metadata?.inventory_quantity ?? 0
    }

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      thumbnail: p.thumbnail ?? null,
      collection: p.collection
        ? { id: p.collection.id, title: p.collection.title }
        : null,
      type: p.type ? { id: p.type.id, value: p.type.value } : null,
      tags: (p.tags || []).map((t: any) => ({ id: t.id, value: t.value })),
      variants_count: variants.length,
      sales_channels: (p.sales_channels || []).map((sc: any) => ({
        id: sc.id,
        name: sc.name,
      })),
      created_at: p.created_at,
      updated_at: p.updated_at,
      metadata: p.metadata ?? null,
      // Legacy fields (pre-parity list consumers).
      variant_count: variants.length,
      price: firstPrice?.amount,
      currency_code: firstPrice?.currency_code,
      stock,
    }
  })

  res.json({ products, count: metadata?.count ?? products.length })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const parsed = CreateProductSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const d = parsed.data
  const productModule: any = req.scope.resolve(Modules.PRODUCT)

  // Resolve tag ids. Explicit tag_ids (new contract) win over the legacy
  // `tags` value list, which is resolved (and created when missing) by value.
  // Implicitly-created tags carry metadata.tenant_id so they show up under the
  // tenant-scoped /merchant/product-tags filter.
  let tagIds: string[] = []
  if (d.tag_ids !== undefined) {
    tagIds = d.tag_ids
  } else if (d.tags.length) {
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
      const id = existingByValue.get(t)
      if (id) tagIds.push(id)
    }
  }

  // Build options/variants payload for Medusa. manage_inventory defaults to
  // true so Medusa creates a REAL inventory item per variant; the initial
  // stock is set as an inventory LEVEL below.
  let workflowOptions: any[] = []
  let workflowVariants: any[] = []
  // Desired initial stock keyed for post-create matching (managed variants only).
  const desiredBySku = new Map<string, number>()
  const desiredByTitle = new Map<string, number>()

  if (d.options.length && d.variants.length) {
    workflowOptions = d.options.map((o) => ({
      title: o.title,
      values: o.values,
    }))

    workflowVariants = d.variants.map((v) => {
      if (v.manage_inventory) {
        if (v.sku) desiredBySku.set(v.sku, v.inventory_quantity)
        desiredByTitle.set(v.title, v.inventory_quantity)
      }
      return {
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        ean: v.ean,
        upc: v.upc,
        prices: v.prices.length ? v.prices : d.prices,
        options: v.options,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
      }
    })
  } else {
    // Single default variant fallback.
    if (d.sku) desiredBySku.set(d.sku, d.inventory_quantity)
    desiredByTitle.set("Default", d.inventory_quantity)
    workflowOptions = [{ title: "Default", values: ["Default"] }]
    workflowVariants = [{
      title: "Default",
      sku: d.sku,
      prices: d.prices,
      options: { Default: "Default" },
      manage_inventory: true,
      allow_backorder: false,
    }]
  }

  // Every product needs a shipping profile or checkout fails ("shipping
  // profiles not satisfied"). Use the requested profile when provided (and
  // valid), otherwise fall back to the shared default profile.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  let shippingProfileId: string | undefined
  if (d.shipping_profile_id) {
    const { data: requested } = await query.graph({
      entity: "shipping_profile",
      filters: { id: d.shipping_profile_id } as any,
      fields: ["id"],
    })
    if (!requested?.[0]?.id) {
      return res.status(400).json({ message: "shipping profile not found" })
    }
    shippingProfileId = requested[0].id
  } else {
    const { data: defaults } = await query.graph({
      entity: "shipping_profile",
      filters: { type: "default" } as any,
      fields: ["id"],
      pagination: { take: 1, skip: 0 } as any,
    })
    shippingProfileId = defaults?.[0]?.id
  }

  const productInput: any = {
    title: d.title,
    handle: slugifyHandle(d.title, d.handle),
    status: d.status,
    tag_ids: tagIds,
    sales_channels: [{ id: scId }],
    shipping_profile_id: shippingProfileId,
    options: workflowOptions,
    variants: workflowVariants,
  }
  if (d.subtitle !== undefined) productInput.subtitle = d.subtitle
  if (d.description !== undefined) productInput.description = d.description
  if (d.discountable !== undefined) productInput.discountable = d.discountable
  if (d.weight !== undefined) productInput.weight = d.weight
  if (d.length !== undefined) productInput.length = d.length
  if (d.height !== undefined) productInput.height = d.height
  if (d.width !== undefined) productInput.width = d.width
  if (d.mid_code !== undefined) productInput.mid_code = d.mid_code
  if (d.hs_code !== undefined) productInput.hs_code = d.hs_code
  if (d.origin_country !== undefined) productInput.origin_country = d.origin_country
  if (d.material !== undefined) productInput.material = d.material
  if (d.external_id !== undefined) productInput.external_id = d.external_id
  if (d.metadata !== undefined) productInput.metadata = d.metadata
  // TENANT NAMESPACE STAMP: handles/SKUs are unique PER STORE (the global
  // unique indexes were replaced with (value, metadata->>'tenant_id') ones),
  // so every product and variant row must carry its owner. Forced last so a
  // client-supplied metadata can never spoof another tenant.
  productInput.metadata = { ...(productInput.metadata ?? {}), tenant_id: ctx.tenant.id }
  productInput.variants = (productInput.variants ?? []).map((v: any) => ({
    ...v,
    metadata: { ...(v.metadata ?? {}), tenant_id: ctx.tenant.id },
  }))
  if (d.thumbnail !== undefined) productInput.thumbnail = d.thumbnail
  if (d.images !== undefined) productInput.images = d.images
  if (d.type_id !== undefined) productInput.type_id = d.type_id
  const collectionId = d.collection_id ?? d.collection_ids[0]
  if (collectionId) productInput.collection_id = collectionId
  if (d.category_ids.length) {
    productInput.categories = d.category_ids.map((id) => ({ id }))
  }

  let product: any
  try {
    const { result: products } = await createProductsWorkflow(req.scope).run({
      input: { products: [productInput] },
    })
    product = (products as any[])[0]
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to create product" })
  }

  // Stamp the variants' inventory items with the tenant namespace NOW: the
  // workflow creates them unstamped, and two stores creating the same SKU
  // before the repair sweep runs would collide in the legacy ('') bucket.
  // (The product and variants are stamped via the input payload above.)
  try {
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await pg.raw(
      `UPDATE inventory_item ii
       SET metadata = coalesce(ii.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', ?::text)
       FROM product_variant_inventory_item pvii
       JOIN product_variant v ON v.id = pvii.variant_id
       WHERE pvii.inventory_item_id = ii.id
         AND v.product_id = ?
         AND (ii.metadata->>'tenant_id') IS NULL`,
      [ctx.tenant.id, product.id]
    )
  } catch {
    /* the 5-minute tenant-stamp-repair sweep is the backstop */
  }

  // Wire REAL inventory: set the initial stock LEVEL at the tenant's default
  // stock location for each managed variant. Gracefully skip if the tenant has
  // no stock location and one cannot be created.
  let inventory_note: string | undefined
  try {
    const createdProduct = await productModule.retrieveProduct(product.id, { relations: ["variants"] })
    const createdVariants = createdProduct.variants || []
    const variantIds = createdVariants.map((v: any) => v.id)
    const { variantToItem } = await getVariantInventoryLinks(req, variantIds)

    const locationId = await getOrCreateDefaultLocation(req, ctx)
    if (!locationId) {
      inventory_note = "no stock location available; stock levels not set"
    } else {
      for (const v of createdVariants) {
        const itemId = variantToItem[v.id]
        if (!itemId) continue
        const qty =
          (v.sku && desiredBySku.has(v.sku) ? desiredBySku.get(v.sku) : undefined) ??
          desiredByTitle.get(v.title)
        if (qty === undefined) continue
        await setStockLevel(req, itemId, locationId, qty as number)
      }
    }
  } catch (e: any) {
    inventory_note = `inventory level setup skipped: ${e?.message || "unknown error"}`
  }

  res.status(201).json({ product, ...(inventory_note ? { inventory_note } : {}) })
}
