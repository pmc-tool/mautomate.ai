import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  deleteInventoryLevelsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { getTenantInventoryContext } from "../../route"
import { buildDetail } from "../route"

const LevelUpdate = z.object({
  location_id: z.string().min(1),
  stocked_quantity: z.number().int().min(0),
})

const SetLevelsSchema = z.union([
  z.object({ updates: z.array(LevelUpdate).min(1) }),
  LevelUpdate,
])

/**
 * POST /merchant/inventory-items/[id]/levels
 *
 * Set (create or update) the REAL stock levels for an inventory item at one or
 * more tenant locations. Accepts either a single { location_id, stocked_quantity }
 * or a batch { updates: [...] }.
 *
 * Double tenant guard, fail-closed:
 *   1. the inventory item must be tenant-visible, and
 *   2. every location must be one of THIS tenant's stock locations.
 * Uses createInventoryLevelsWorkflow / updateInventoryLevelsWorkflow depending on
 * whether a level already exists at (item, location).
 */
async function handle(req: MedusaRequest, res: MedusaResponse) {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params

  const parsed = SetLevelsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const updates = "updates" in parsed.data ? parsed.data.updates : [parsed.data]

  // Guard 1: item is tenant-visible.
  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(id)) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  // Guard 2: every location is one of this tenant's stock locations.
  for (const u of updates) {
    if (!tctx.tenantLocationIds.has(u.location_id)) {
      return res.status(404).json({ message: "stock location not found" })
    }
  }

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const existing = await inventoryModule.listInventoryLevels(
    { inventory_item_id: id, location_id: updates.map((u) => u.location_id) },
    { take: updates.length }
  )
  const existingLocations = new Set<string>((existing || []).map((l: any) => l.location_id))

  const toCreate = updates.filter((u) => !existingLocations.has(u.location_id))
  const toUpdate = updates.filter((u) => existingLocations.has(u.location_id))

  try {
    if (toCreate.length) {
      await createInventoryLevelsWorkflow(req.scope).run({
        input: {
          inventory_levels: toCreate.map((u) => ({
            inventory_item_id: id,
            location_id: u.location_id,
            stocked_quantity: u.stocked_quantity,
          })),
        },
      })
    }
    if (toUpdate.length) {
      await updateInventoryLevelsWorkflow(req.scope).run({
        input: {
          updates: toUpdate.map((u) => ({
            inventory_item_id: id,
            location_id: u.location_id,
            stocked_quantity: u.stocked_quantity,
          })),
        },
      })
    }
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to set stock level" })
  }

  const detail = await buildDetail(req, ctx, id)
  res.json({ item: detail })
}

export const POST = handle
export const PUT = handle

/**
 * DELETE /merchant/inventory-items/[id]/levels?location_id=...
 *
 * Removes an inventory level via deleteInventoryLevelsWorkflow. Medusa blocks
 * deletion when the level still has stocked/reserved/incoming quantity; that
 * error is surfaced to the client (400). Fail-closed tenant guards apply.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const locationId =
    typeof req.query.location_id === "string" ? req.query.location_id : ""
  if (!locationId) {
    return res.status(400).json({ message: "location_id is required" })
  }

  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(id)) {
    return res.status(404).json({ message: "inventory item not found" })
  }
  if (!tctx.tenantLocationIds.has(locationId)) {
    return res.status(404).json({ message: "stock location not found" })
  }

  try {
    await deleteInventoryLevelsWorkflow(req.scope).run({
      input: { inventory_item_id: id, location_id: locationId },
    })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to delete stock level" })
  }

  const detail = await buildDetail(req, ctx, id)
  res.json({ item: detail })
}
