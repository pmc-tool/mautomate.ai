import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"
import {
  getTenantVariantIds,
  getVariantInventoryLinks,
  getTenantLocations,
} from "../../_inventory"

/**
 * GET /merchant/inventory-items/[id]
 *
 * One inventory item plus its per-location levels. Fail-closed: 404 unless the
 * item is linked to a variant in THIS tenant's sales channel.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "inventory item not found" })

  const { id } = req.params

  // Tenant-ownership guard.
  const variantIds = await getTenantVariantIds(req, scId)
  const { itemToVariant } = await getVariantInventoryLinks(req, variantIds)
  const variantId = itemToVariant[id]
  if (!variantId) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const item = await inventoryModule.retrieveInventoryItem(id).catch(() => null)
  if (!item) return res.status(404).json({ message: "inventory item not found" })

  const levels = await inventoryModule.listInventoryLevels(
    { inventory_item_id: id },
    { take: 500 }
  )

  // Restrict reported levels to the tenant's own locations, and label them.
  const tenantLocations = await getTenantLocations(req, ctx)
  const locNameById = new Map<string, string>(
    tenantLocations.map((l: any) => [l.id, l.name])
  )

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: [variantId] } as any,
    fields: ["id", "title", "sku", "product_id", "product.title"],
  })
  const variant = (variants || [])[0] as any

  const location_levels = (levels || []).map((l: any) => ({
    location_id: l.location_id,
    location_name: locNameById.get(l.location_id) ?? null,
    is_tenant_location: locNameById.has(l.location_id),
    stocked_quantity: l.stocked_quantity,
    reserved_quantity: l.reserved_quantity,
    available_quantity: l.available_quantity ?? l.stocked_quantity,
    incoming_quantity: l.incoming_quantity,
  }))

  res.json({
    inventory_item: {
      id: item.id,
      sku: item.sku ?? variant?.sku ?? null,
      title: item.title ?? variant?.title ?? null,
      requires_shipping: item.requires_shipping,
      variant_id: variantId,
      product_id: variant?.product_id ?? null,
      product_title: variant?.product?.title ?? null,
      stocked_quantity: location_levels.reduce((s, l) => s + (Number(l.stocked_quantity) || 0), 0),
      reserved_quantity: location_levels.reduce((s, l) => s + (Number(l.reserved_quantity) || 0), 0),
      available_quantity: location_levels.reduce(
        (s, l) => s + (Number(l.available_quantity) || 0),
        0
      ),
      location_levels,
    },
  })
}
