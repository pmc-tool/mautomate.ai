import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import {
  getTenantVariantIds,
  getVariantInventoryLinks,
  isTenantLocation,
  setStockLevel,
} from "../../../_inventory"

const SetLevelSchema = z.object({
  location_id: z.string().min(1),
  stocked_quantity: z.number().int().min(0),
})

/**
 * Set/adjust the REAL stock level for an inventory item at one location.
 *
 * Double tenant guard, fail-closed:
 *   1. the inventory item must be linked to a variant in THIS tenant's sales
 *      channel, and
 *   2. the location must be one of THIS tenant's stock locations
 *      (metadata.tenant_id).
 * Either miss -> 404. Never writes across tenants.
 */
async function handle(req: MedusaRequest, res: MedusaResponse) {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "inventory item not found" })

  const { id } = req.params

  const parsed = SetLevelSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { location_id, stocked_quantity } = parsed.data

  // Guard 1: item belongs to a variant in this tenant's sales channel.
  const variantIds = await getTenantVariantIds(req, scId)
  const { itemToVariant } = await getVariantInventoryLinks(req, variantIds)
  if (!itemToVariant[id]) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  // Guard 2: location is one of this tenant's stock locations.
  if (!(await isTenantLocation(req, ctx, location_id))) {
    return res.status(404).json({ message: "stock location not found" })
  }

  try {
    const level = await setStockLevel(req, id, location_id, stocked_quantity)
    const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
    const [fresh] = await inventoryModule.listInventoryLevels(
      { inventory_item_id: id, location_id },
      { take: 1 }
    )
    const out = fresh || level
    res.json({
      inventory_level: {
        inventory_item_id: id,
        location_id,
        stocked_quantity: out?.stocked_quantity ?? stocked_quantity,
        reserved_quantity: out?.reserved_quantity ?? 0,
        available_quantity: out?.available_quantity ?? out?.stocked_quantity ?? stocked_quantity,
      },
    })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to set stock level" })
  }
}

export const POST = handle
export const PUT = handle
