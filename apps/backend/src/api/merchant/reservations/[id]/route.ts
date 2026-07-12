import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  updateReservationsWorkflow,
  deleteReservationsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import {
  getTenantLocationContext,
  hydrateReservations,
} from "../route"

/**
 * Load a reservation and enforce fail-closed tenant ownership: the reservation's
 * location must be one of the tenant's stock locations. Returns null otherwise.
 */
async function loadTenantReservation(req: MedusaRequest, ctx: any, id: string) {
  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const reservation = await inventoryModule.retrieveReservationItem(id).catch(() => null)
  if (!reservation) return { reservation: null as any, ownedLocation: false, locNameById: new Map() }

  const { locationIds, locNameById } = await getTenantLocationContext(req, ctx)
  return {
    reservation,
    ownedLocation: locationIds.has(reservation.location_id),
    locationIds,
    locNameById,
  }
}

/**
 * GET /merchant/reservations/[id]
 *
 * One reservation with item/location hydration plus the stocked/reserved/
 * available figures for the reservation's location. 404 unless tenant-owned.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const { reservation, ownedLocation, locNameById } = await loadTenantReservation(
    req,
    ctx,
    id
  )
  if (!reservation || !ownedLocation) {
    return res.status(404).json({ message: "reservation not found" })
  }

  const [hydrated] = await hydrateReservations(req, [reservation], locNameById)

  // Level figures for the reservation's location.
  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const [level] = await inventoryModule.listInventoryLevels(
    { inventory_item_id: reservation.inventory_item_id, location_id: reservation.location_id },
    { take: 1 }
  )
  const location_level = level
    ? {
        stocked_quantity: Number(level.stocked_quantity) || 0,
        reserved_quantity: Number(level.reserved_quantity) || 0,
        available_quantity:
          Number(
            level.available_quantity ??
              (level.stocked_quantity ?? 0) - (level.reserved_quantity ?? 0)
          ) || 0,
        incoming_quantity: Number(level.incoming_quantity) || 0,
      }
    : null

  res.json({ reservation: { ...hydrated, metadata: reservation.metadata ?? null, location_level } })
}

const UpdateReservationSchema = z.object({
  location_id: z.string().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  description: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

/**
 * POST /merchant/reservations/[id]
 *
 * Updates a manual reservation via updateReservationsWorkflow. Order-linked
 * reservations (line_item_id set) are managed by the order flow and are
 * read-only here -> 400. When moving locations, the target must be tenant-owned.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const { reservation, ownedLocation, locationIds, locNameById } =
    await loadTenantReservation(req, ctx, id)
  if (!reservation || !ownedLocation) {
    return res.status(404).json({ message: "reservation not found" })
  }
  if (reservation.line_item_id) {
    return res.status(400).json({
      message: "Order reservations cannot be edited.",
    })
  }

  const parsed = UpdateReservationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const data = parsed.data

  if (data.location_id && !locationIds!.has(data.location_id)) {
    return res.status(404).json({ message: "stock location not found" })
  }

  try {
    await updateReservationsWorkflow(req.scope).run({
      input: {
        updates: [
          {
            id,
            ...(data.location_id ? { location_id: data.location_id } : {}),
            ...(data.quantity != null ? { quantity: data.quantity } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
          },
        ],
      },
    })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to update reservation" })
  }

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const fresh = await inventoryModule.retrieveReservationItem(id).catch(() => reservation)
  const [hydrated] = await hydrateReservations(req, [fresh], locNameById)
  res.json({ reservation: hydrated })
}

/**
 * DELETE /merchant/reservations/[id]
 *
 * Deletes a manual reservation via deleteReservationsWorkflow. Order-linked
 * reservations are refused (400) to avoid corrupting order fulfillment state.
 * Fail-closed tenant ownership guard applies.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const { reservation, ownedLocation } = await loadTenantReservation(req, ctx, id)
  if (!reservation || !ownedLocation) {
    return res.status(404).json({ message: "reservation not found" })
  }
  if (reservation.line_item_id) {
    return res.status(400).json({
      message: "Order reservations cannot be deleted.",
    })
  }

  try {
    await deleteReservationsWorkflow(req.scope).run({ input: { ids: [id] } })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to delete reservation" })
  }

  res.status(200).json({ id, object: "reservation", deleted: true })
}
