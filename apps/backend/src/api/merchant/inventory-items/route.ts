import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"
import { getTenantVariantIds, getVariantInventoryLinks } from "../_inventory"

/**
 * GET /merchant/inventory-items
 *
 * REAL inventory (not the old variant.metadata.inventory_quantity hack). Lists
 * the inventory items for THIS tenant's variants: tenant sales channel ->
 * products -> variants -> product_variant_inventory_item link -> inventory items,
 * with stocked/reserved/available per stock location. Fail-closed: only items
 * reachable through the tenant's sales channel are ever returned.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ inventory_items: [], count: 0 })

  const variantIds = await getTenantVariantIds(req, scId)
  if (!variantIds.length) return res.json({ inventory_items: [], count: 0 })

  const { itemToVariant } = await getVariantInventoryLinks(req, variantIds)
  const itemIds = Object.keys(itemToVariant)
  if (!itemIds.length) return res.json({ inventory_items: [], count: 0 })

  // Variant + product context for display.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: variantIds } as any,
    fields: ["id", "title", "sku", "product_id", "product.title"],
  })
  const variantById = new Map<string, any>()
  for (const v of variants || []) variantById.set((v as any).id, v)

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const items = await inventoryModule.listInventoryItems({ id: itemIds }, { take: itemIds.length })
  const levels = await inventoryModule.listInventoryLevels(
    { inventory_item_id: itemIds },
    { take: 10000 }
  )
  const levelsByItem = new Map<string, any[]>()
  for (const lvl of levels || []) {
    const arr = levelsByItem.get(lvl.inventory_item_id) || []
    arr.push(lvl)
    levelsByItem.set(lvl.inventory_item_id, arr)
  }

  const inventory_items = (items || []).map((it: any) => {
    const variantId = itemToVariant[it.id]
    const variant = variantId ? variantById.get(variantId) : undefined
    const itemLevels = levelsByItem.get(it.id) || []
    const stocked = itemLevels.reduce((s, l) => s + (Number(l.stocked_quantity) || 0), 0)
    const reserved = itemLevels.reduce((s, l) => s + (Number(l.reserved_quantity) || 0), 0)
    const available = itemLevels.reduce(
      (s, l) => s + (Number(l.available_quantity ?? l.stocked_quantity) || 0),
      0
    )
    return {
      id: it.id,
      sku: it.sku ?? variant?.sku ?? null,
      title: it.title ?? variant?.title ?? null,
      requires_shipping: it.requires_shipping,
      variant_id: variantId ?? null,
      product_id: variant?.product_id ?? null,
      product_title: variant?.product?.title ?? null,
      stocked_quantity: stocked,
      reserved_quantity: reserved,
      available_quantity: available,
      location_levels: itemLevels.map((l: any) => ({
        location_id: l.location_id,
        stocked_quantity: l.stocked_quantity,
        reserved_quantity: l.reserved_quantity,
        available_quantity: l.available_quantity ?? l.stocked_quantity,
      })),
    }
  })

  res.json({ inventory_items, count: inventory_items.length })
}
