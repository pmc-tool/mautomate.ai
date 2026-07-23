import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryItemsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant, MerchantCtx } from "../_helpers"
import {
  getTenantVariantIds,
  getVariantInventoryLinks,
  getTenantLocations,
  getOrCreateDefaultLocation,
} from "../_inventory"

/**
 * Tenant reach for inventory items. An item is tenant-visible iff it is linked
 * to a variant of a tenant-owned product (via the sales channel) OR it has an
 * inventory level at a tenant-owned stock location (metadata.tenant_id).
 *
 * Fail-closed by construction: the returned id set is the ONLY set of items the
 * tenant may ever read or mutate. Everything else is invisible.
 */
export type TenantInventoryContext = {
  itemIds: string[]
  itemIdSet: Set<string>
  itemToVariants: Record<string, string[]>
  tenantLocationIds: Set<string>
  locNameById: Map<string, string>
}

export async function getTenantInventoryContext(
  req: MedusaRequest,
  ctx: MerchantCtx
): Promise<TenantInventoryContext> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)

  const itemIdSet = new Set<string>()
  const itemToVariants: Record<string, string[]> = {}

  // Path 1: items linked to variants in the tenant's sales channel.
  const scId = ctx.tenant.meta?.sales_channel_id
  if (scId) {
    const variantIds = await getTenantVariantIds(req, scId)
    if (variantIds.length) {
      const { data: links } = await query.graph({
        entity: "product_variant_inventory_item",
        filters: { variant_id: variantIds } as any,
        fields: ["variant_id", "inventory_item_id"],
      })
      for (const l of links || []) {
        const lk = l as any
        if (!lk.inventory_item_id || !lk.variant_id) continue
        itemIdSet.add(lk.inventory_item_id)
        const arr = itemToVariants[lk.inventory_item_id] || []
        if (!arr.includes(lk.variant_id)) arr.push(lk.variant_id)
        itemToVariants[lk.inventory_item_id] = arr
      }
    }
  }

  // Path 2: items with a level at one of the tenant's stock locations.
  const tenantLocations = await getTenantLocations(req, ctx)
  const tenantLocationIds = new Set<string>(tenantLocations.map((l: any) => l.id))
  const locNameById = new Map<string, string>(
    tenantLocations.map((l: any) => [l.id, l.name])
  )
  if (tenantLocationIds.size) {
    const levels = await inventoryModule.listInventoryLevels(
      { location_id: Array.from(tenantLocationIds) },
      { take: 100000 }
    )
    for (const lvl of levels || []) {
      if (lvl?.inventory_item_id) itemIdSet.add(lvl.inventory_item_id)
    }
  }

  return {
    itemIds: Array.from(itemIdSet),
    itemIdSet,
    itemToVariants,
    tenantLocationIds,
    locNameById,
  }
}

/**
 * GET /merchant/inventory-items
 *
 * Widened list matching the Medusa admin inventory table: free-text q (title +
 * sku), reserved/stocked totals per item, and the titles of the variants the
 * item is linked to. Offset pagination. Fail-closed: only tenant-visible items.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))

  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIds.length) return res.json({ items: [], count: 0 })

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const items = await inventoryModule.listInventoryItems(
    { id: tctx.itemIds },
    { take: tctx.itemIds.length }
  )

  // Levels for stocked/reserved totals (restricted to tenant locations).
  const levels = await inventoryModule.listInventoryLevels(
    {
      inventory_item_id: tctx.itemIds,
      location_id: Array.from(tctx.tenantLocationIds),
    },
    { take: 100000 }
  )
  const stockedByItem = new Map<string, number>()
  const reservedByItem = new Map<string, number>()
  for (const l of levels || []) {
    stockedByItem.set(
      l.inventory_item_id,
      (stockedByItem.get(l.inventory_item_id) || 0) + (Number(l.stocked_quantity) || 0)
    )
    reservedByItem.set(
      l.inventory_item_id,
      (reservedByItem.get(l.inventory_item_id) || 0) + (Number(l.reserved_quantity) || 0)
    )
  }

  // Variant titles + product thumbnails for display.
  const allVariantIds = Object.values(tctx.itemToVariants).flat()
  const variantById = new Map<string, any>()
  if (allVariantIds.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: variants } = await query.graph({
      entity: "product_variant",
      filters: { id: allVariantIds } as any,
      fields: ["id", "title", "sku", "product.title", "product.thumbnail"],
    })
    for (const v of variants || []) variantById.set((v as any).id, v)
  }

  let rows = (items || []).map((it: any) => {
    const variantIds = tctx.itemToVariants[it.id] || []
    const variants = variantIds.map((vid) => variantById.get(vid)).filter(Boolean)
    const thumbnail =
      variants.map((v: any) => v?.product?.thumbnail).find((t: any) => !!t) || null
    // Show the PRODUCT name (append the variant title only when it is a real
    // variant, not the auto "Default"/"Default variant" placeholder).
    const productTitle =
      variants.map((v: any) => v?.product?.title).find((t: any) => !!t) || null
    const variantTitle = variants[0]?.title ?? null
    return {
      id: it.id,
      title: productTitle
        ? variantTitle && !/^default/i.test(variantTitle)
          ? `${productTitle} · ${variantTitle}`
          : productTitle
        : it.title ?? variantTitle ?? null,
      sku: it.sku ?? variants[0]?.sku ?? null,
      thumbnail,
      reserved_quantity: reservedByItem.get(it.id) || 0,
      stocked_quantity: stockedByItem.get(it.id) || 0,
      variant_titles: variants.map((v: any) => v.title).filter(Boolean),
    }
  })

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.title || "").toLowerCase().includes(needle) ||
        (r.sku || "").toLowerCase().includes(needle) ||
        r.variant_titles.some((t: string) => t.toLowerCase().includes(needle))
    )
  }

  rows.sort((a, b) => (a.title || a.sku || "").localeCompare(b.title || b.sku || ""))

  const count = rows.length
  const paged = rows.slice(offset, offset + limit)
  res.json({ items: paged, count })
}

const CreateInventoryItemSchema = z.object({
  title: z.string().optional(),
  sku: z.string().optional(),
  requires_shipping: z.boolean().optional().default(true),
  origin_country: z.string().optional().nullable(),
  hs_code: z.string().optional().nullable(),
  mid_code: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  length: z.number().min(0).optional().nullable(),
  height: z.number().min(0).optional().nullable(),
  width: z.number().min(0).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  location_levels: z
    .array(
      z.object({
        location_id: z.string().min(1),
        stocked_quantity: z.number().int().min(0).optional().default(0),
      })
    )
    .optional()
    .default([]),
})

/**
 * POST /merchant/inventory-items
 *
 * Creates a standalone inventory item via createInventoryItemsWorkflow. Any
 * supplied location_levels must reference tenant-owned locations (fail-closed
 * 400 otherwise). To guarantee the new item stays tenant-reachable, a level at
 * the tenant's default location is always ensured.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateInventoryItemSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { location_levels, ...attributes } = parsed.data

  const tenantLocations = await getTenantLocations(req, ctx)
  const tenantLocationIds = new Set<string>(tenantLocations.map((l: any) => l.id))

  for (const lvl of location_levels) {
    if (!tenantLocationIds.has(lvl.location_id)) {
      return res.status(400).json({ message: "stock location not found" })
    }
  }

  // Ensure the item is tenant-reachable via at least the default location.
  const defaultLocationId = await getOrCreateDefaultLocation(req, ctx)
  const levelsByLocation = new Map<string, number>()
  for (const lvl of location_levels) {
    levelsByLocation.set(lvl.location_id, lvl.stocked_quantity ?? 0)
  }
  if (defaultLocationId && !levelsByLocation.has(defaultLocationId)) {
    levelsByLocation.set(defaultLocationId, 0)
  }

  const item_location_levels = Array.from(levelsByLocation.entries()).map(
    ([location_id, stocked_quantity]) => ({ location_id, stocked_quantity })
  )

  const { result } = await createInventoryItemsWorkflow(req.scope).run({
    input: {
      items: [
        {
          ...(attributes as any),
          location_levels: item_location_levels,
        },
      ],
    },
  })

  const created = (result as any[])[0]
  res.status(201).json({ item: created })
}
