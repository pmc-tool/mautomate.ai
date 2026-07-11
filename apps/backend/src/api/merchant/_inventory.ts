import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/core-flows"
import { MerchantCtx } from "./_helpers"

/**
 * Shared REAL-inventory helpers for the tenant-scoped /merchant routes.
 *
 * Stock is stored as Medusa inventory levels (stocked_quantity per
 * stock_location), NOT in variant.metadata.inventory_quantity. Every helper is
 * tenant-scoped: variants are reached only through the tenant's sales channel
 * and locations only through metadata.tenant_id. Fail-closed by construction —
 * anything outside the tenant is simply never returned.
 */

// All variant ids belonging to the tenant's sales channel.
export async function getTenantVariantIds(req: MedusaRequest, scId: string): Promise<string[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const productIds = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!productIds.length) return []

  const { data: products } = await query.graph({
    entity: "product",
    filters: { id: productIds } as any,
    fields: ["id", "variants.id"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  const ids: string[] = []
  for (const p of products || []) {
    for (const v of (p as any).variants || []) {
      if (v?.id) ids.push(v.id)
    }
  }
  return ids
}

// Map inventory_item_id <-> variant_id for a set of variants (via the
// product_variant_inventory_item module link).
export async function getVariantInventoryLinks(
  req: MedusaRequest,
  variantIds: string[]
): Promise<{ itemToVariant: Record<string, string>; variantToItem: Record<string, string> }> {
  const itemToVariant: Record<string, string> = {}
  const variantToItem: Record<string, string> = {}
  if (!variantIds.length) return { itemToVariant, variantToItem }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_item",
    filters: { variant_id: variantIds } as any,
    fields: ["variant_id", "inventory_item_id"],
  })
  for (const l of links || []) {
    const lk = l as any
    if (lk.inventory_item_id && lk.variant_id) {
      itemToVariant[lk.inventory_item_id] = lk.variant_id
      variantToItem[lk.variant_id] = lk.inventory_item_id
    }
  }
  return { itemToVariant, variantToItem }
}

// The tenant's stock locations (global rows tagged with metadata.tenant_id).
export async function getTenantLocations(req: MedusaRequest, ctx: MerchantCtx): Promise<any[]> {
  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)
  const all = await stockLocationModule.listStockLocations(
    {},
    { take: 500, relations: ["address"] }
  )
  return (all || []).filter((l: any) => l.metadata?.tenant_id === ctx.tenant.id)
}

export async function isTenantLocation(
  req: MedusaRequest,
  ctx: MerchantCtx,
  locationId: string
): Promise<boolean> {
  const locs = await getTenantLocations(req, ctx)
  return locs.some((l: any) => l.id === locationId)
}

// Is this inventory item linked to a variant in the tenant's sales channel?
export async function isTenantInventoryItem(
  req: MedusaRequest,
  scId: string,
  inventoryItemId: string
): Promise<boolean> {
  const variantIds = await getTenantVariantIds(req, scId)
  if (!variantIds.length) return false
  const { itemToVariant } = await getVariantInventoryLinks(req, variantIds)
  return Boolean(itemToVariant[inventoryItemId])
}

/**
 * The tenant's default stock location. Returns the first tenant-tagged location,
 * or creates one (tagged with tenant_id and linked to the sales channel) when
 * the tenant has none yet. Returns null only if creation is impossible.
 */
export async function getOrCreateDefaultLocation(
  req: MedusaRequest,
  ctx: MerchantCtx
): Promise<string | null> {
  const existing = await getTenantLocations(req, ctx)
  if (existing.length) return existing[0].id

  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)
  const created = await stockLocationModule.createStockLocations({
    name: `${ctx.tenant.name || "Default"} Warehouse`,
    metadata: { tenant_id: ctx.tenant.id },
  })
  const locId = Array.isArray(created) ? created[0]?.id : created?.id
  if (!locId) return null

  const scId = ctx.tenant.meta?.sales_channel_id
  if (scId) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(req.scope).run({
        input: { id: locId, add: [scId] },
      })
    } catch (e) {
      // Best-effort: inventory levels still work without the SC link.
    }
  }
  return locId
}

// Set (create or update) the stock level for an inventory item at a location.
export async function setStockLevel(
  req: MedusaRequest,
  inventoryItemId: string,
  locationId: string,
  stockedQuantity: number
): Promise<any> {
  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const existing = await inventoryModule.listInventoryLevels(
    { inventory_item_id: inventoryItemId, location_id: locationId },
    { take: 1 }
  )
  const payload = {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    stocked_quantity: stockedQuantity,
  }
  if (existing && existing.length) {
    const [updated] = await inventoryModule.updateInventoryLevels([payload])
    return updated
  }
  const [created] = await inventoryModule.createInventoryLevels([payload])
  return created
}

// Total available quantity per variant (summed across the tenant's levels).
export async function getAvailableByVariant(
  req: MedusaRequest,
  variantIds: string[]
): Promise<Record<string, number>> {
  const byVariant: Record<string, number> = {}
  if (!variantIds.length) return byVariant

  const { itemToVariant } = await getVariantInventoryLinks(req, variantIds)
  const itemIds = Object.keys(itemToVariant)
  if (!itemIds.length) return byVariant

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const levels = await inventoryModule.listInventoryLevels(
    { inventory_item_id: itemIds },
    { take: 10000 }
  )
  for (const lvl of levels || []) {
    const vId = itemToVariant[lvl.inventory_item_id]
    if (!vId) continue
    const available = Number(lvl.available_quantity ?? lvl.stocked_quantity) || 0
    byVariant[vId] = (byVariant[vId] || 0) + available
  }
  return byVariant
}
