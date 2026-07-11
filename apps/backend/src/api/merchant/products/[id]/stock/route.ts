import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import {
  getOrCreateDefaultLocation,
  getTenantLocations,
  getVariantInventoryLinks,
} from "../../../_inventory"

const UpdateStockSchema = z.object({
  updates: z
    .array(
      z.object({
        inventory_item_id: z.string().min(1),
        location_id: z.string().min(1),
        stocked_quantity: z.number().min(0).finite(),
      })
    )
    .min(1),
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

const levelKey = (itemId: string, locationId: string) => `${itemId}:${locationId}`

/**
 * GET /merchant/products/[id]/stock
 *
 * Per-variant stock matrix for the stock editor: every variant of the
 * tenant-owned product with its inventory item and one row per tenant stock
 * location (stocked/reserved; zeros when no level exists yet). Guarantees at
 * least one tenant location exists so the editor always has a column.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    filters: { id } as any,
    fields: ["id", "variants.id", "variants.title", "variants.sku"],
  })
  const product = (products || [])[0] as any
  if (!product) {
    return res.status(404).json({ message: "product not found" })
  }

  const productVariants = (product.variants || []).filter(Boolean)
  const variantIds = productVariants.map((v: any) => v.id)
  const { variantToItem } = await getVariantInventoryLinks(req, variantIds)

  // Ensure the tenant has at least one stock location so the editor has a
  // column to write into (mirrors product-create behavior).
  let locations = await getTenantLocations(req, ctx)
  if (!locations.length) {
    const createdId = await getOrCreateDefaultLocation(req, ctx)
    if (createdId) {
      locations = await getTenantLocations(req, ctx)
    }
  }

  const itemIds = [...new Set(Object.values(variantToItem))]
  const levelMap = new Map<string, any>()
  if (itemIds.length) {
    const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
    const levels = await inventoryModule.listInventoryLevels(
      { inventory_item_id: itemIds },
      { take: 10000 }
    )
    for (const lvl of levels || []) {
      levelMap.set(levelKey(lvl.inventory_item_id, lvl.location_id), lvl)
    }
  }

  const variants = productVariants.map((v: any) => {
    const itemId = variantToItem[v.id] || null
    return {
      variant_id: v.id,
      variant_title: v.title || "",
      sku: v.sku ?? null,
      inventory_item_id: itemId,
      locations: itemId
        ? locations.map((loc: any) => {
            const lvl = levelMap.get(levelKey(itemId, loc.id))
            return {
              location_id: loc.id,
              location_name: loc.name || "",
              stocked_quantity: Number(lvl?.stocked_quantity) || 0,
              reserved_quantity: Number(lvl?.reserved_quantity) || 0,
            }
          })
        : [],
    }
  })

  res.json({ variants })
}

/**
 * POST /merchant/products/[id]/stock
 *
 * Batch stock update. Body: { updates: [{ inventory_item_id, location_id,
 * stocked_quantity }] }. Updates existing levels via
 * updateInventoryLevelsWorkflow and creates missing ones via
 * createInventoryLevelsWorkflow. Double tenant guard: items must belong to
 * THIS product's variants and locations must be tenant-tagged.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const parsed = UpdateStockSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { updates } = parsed.data

  // Guard 1: every inventory item belongs to a variant of THIS product.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: productVariants } = await query.graph({
    entity: "product_variant",
    filters: { product_id: id } as any,
    fields: ["id"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  const variantIds = (productVariants || []).map((v: any) => v.id)
  const { variantToItem } = await getVariantInventoryLinks(req, variantIds)
  const validItemIds = new Set(Object.values(variantToItem))
  for (const u of updates) {
    if (!validItemIds.has(u.inventory_item_id)) {
      return res.status(404).json({ message: "inventory item not found on this product" })
    }
  }

  // Guard 2: every location is one of this tenant's stock locations.
  const tenantLocations = await getTenantLocations(req, ctx)
  const validLocationIds = new Set(tenantLocations.map((l: any) => l.id))
  for (const u of updates) {
    if (!validLocationIds.has(u.location_id)) {
      return res.status(404).json({ message: "stock location not found" })
    }
  }

  // Dedupe by item+location (last entry wins), then split into update (level
  // exists) vs create (no level yet for that location).
  const byPair = new Map<string, { inventory_item_id: string; location_id: string; stocked_quantity: number }>()
  for (const u of updates) {
    byPair.set(levelKey(u.inventory_item_id, u.location_id), {
      inventory_item_id: u.inventory_item_id,
      location_id: u.location_id,
      stocked_quantity: u.stocked_quantity,
    })
  }

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const itemIds = [...new Set(updates.map((u) => u.inventory_item_id))]
  const existingLevels = await inventoryModule.listInventoryLevels(
    { inventory_item_id: itemIds },
    { take: 10000 }
  )
  const existingPairs = new Set(
    (existingLevels || []).map((l: any) => levelKey(l.inventory_item_id, l.location_id))
  )

  const toUpdate: any[] = []
  const toCreate: any[] = []
  for (const [pair, payload] of byPair.entries()) {
    if (existingPairs.has(pair)) {
      toUpdate.push(payload)
    } else {
      toCreate.push(payload)
    }
  }

  try {
    if (toCreate.length) {
      await createInventoryLevelsWorkflow(req.scope).run({
        input: { inventory_levels: toCreate },
      })
    }
    if (toUpdate.length) {
      await updateInventoryLevelsWorkflow(req.scope).run({
        input: { updates: toUpdate },
      })
    }
    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to update stock levels" })
  }
}
