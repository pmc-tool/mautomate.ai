import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createReservationsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant, MerchantCtx } from "../_helpers"
import { getTenantLocations } from "../_inventory"
import { getTenantInventoryContext } from "../inventory-items/route"

/**
 * Resolve order display ids for a set of line item ids, best-effort. Reservations
 * created by the order flow carry a line_item_id; the human-facing order number
 * (display_id) is reached via order_line_item -> order. Never throws: if the
 * graph relation is unavailable the mapping is simply empty.
 */
export async function resolveOrderDisplayIds(
  req: MedusaRequest,
  lineItemIds: (string | null | undefined)[]
): Promise<Record<string, string | number>> {
  const out: Record<string, string | number> = {}
  const ids = Array.from(new Set(lineItemIds.filter(Boolean) as string[]))
  if (!ids.length) return out
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order_line_item",
      filters: { id: ids } as any,
      fields: ["id", "order.id", "order.display_id"],
    })
    for (const li of data || []) {
      const disp = (li as any)?.order?.display_id
      if (disp != null) out[(li as any).id] = disp
    }
  } catch (e) {
    // Best-effort only; order_display_id stays undefined.
  }
  return out
}

/**
 * Hydrate raw reservation rows into the API contract shape: inventory item
 * title/sku, location name, and (when resolvable) the order display id.
 */
export async function hydrateReservations(
  req: MedusaRequest,
  reservations: any[],
  locNameById: Map<string, string>
): Promise<any[]> {
  if (!reservations.length) return []

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const itemIds = Array.from(
    new Set(reservations.map((r) => r.inventory_item_id).filter(Boolean))
  )
  const itemById = new Map<string, any>()
  if (itemIds.length) {
    const items = await inventoryModule.listInventoryItems(
      { id: itemIds },
      { take: itemIds.length }
    )
    for (const it of items || []) itemById.set(it.id, it)
  }

  const orderDisplayByLineItem = await resolveOrderDisplayIds(
    req,
    reservations.map((r) => r.line_item_id)
  )

  return reservations.map((r) => {
    const item = itemById.get(r.inventory_item_id)
    const orderDisplayId = r.line_item_id
      ? orderDisplayByLineItem[r.line_item_id]
      : undefined
    return {
      id: r.id,
      inventory_item_id: r.inventory_item_id,
      item_title: item?.title ?? item?.sku ?? null,
      sku: item?.sku ?? null,
      location_id: r.location_id,
      location_name: locNameById.get(r.location_id) ?? null,
      quantity: Number(r.quantity) || 0,
      line_item_id: r.line_item_id ?? null,
      ...(orderDisplayId != null ? { order_display_id: orderDisplayId } : {}),
      description: r.description ?? null,
      created_by: r.created_by ?? null,
      created_at: r.created_at,
    }
  })
}

/**
 * The tenant's location context for reservation scoping: reservations are
 * tenant-visible iff their location is tenant-owned.
 */
export async function getTenantLocationContext(req: MedusaRequest, ctx: MerchantCtx) {
  const locations = await getTenantLocations(req, ctx)
  const locationIds = new Set<string>(locations.map((l: any) => l.id))
  const locNameById = new Map<string, string>(locations.map((l: any) => [l.id, l.name]))
  return { locationIds, locNameById }
}

/**
 * GET /merchant/reservations
 *
 * Lists reservations whose location is tenant-owned. Supports q (item title/sku
 * or description), optional location_id / inventory_item_id filters, and offset
 * pagination. Newest first. Fail-closed by location ownership.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const filterLocationId =
    typeof req.query.location_id === "string" ? req.query.location_id : ""
  const filterItemId =
    typeof req.query.inventory_item_id === "string" ? req.query.inventory_item_id : ""

  const { locationIds, locNameById } = await getTenantLocationContext(req, ctx)
  if (!locationIds.size) return res.json({ reservations: [], count: 0 })

  // Constrain locations to tenant-owned; honor a client location filter only if
  // it is one of ours.
  let locations = Array.from(locationIds)
  if (filterLocationId) {
    if (!locationIds.has(filterLocationId)) return res.json({ reservations: [], count: 0 })
    locations = [filterLocationId]
  }

  const filters: any = { location_id: locations }
  if (filterItemId) {
    const tctx = await getTenantInventoryContext(req, ctx)
    if (!tctx.itemIdSet.has(filterItemId)) return res.json({ reservations: [], count: 0 })
    filters.inventory_item_id = filterItemId
  }

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const raw = await inventoryModule.listReservationItems(filters, {
    take: 100000,
    order: { created_at: "DESC" },
  })

  let rows = await hydrateReservations(req, raw || [], locNameById)

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.item_title || "").toLowerCase().includes(needle) ||
        (r.sku || "").toLowerCase().includes(needle) ||
        (r.description || "").toLowerCase().includes(needle)
    )
  }

  const count = rows.length
  const paged = rows.slice(offset, offset + limit)
  res.json({ reservations: paged, count })
}

const CreateReservationSchema = z.object({
  inventory_item_id: z.string().min(1),
  location_id: z.string().min(1),
  quantity: z.number().int().min(1),
  description: z.string().optional().nullable(),
})

/**
 * POST /merchant/reservations
 *
 * Creates a manual reservation via createReservationsWorkflow. Guards: the item
 * must be tenant-visible and the location must be tenant-owned. The workflow
 * validates available quantity and throws when insufficient (surfaced as 400).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateReservationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { inventory_item_id, location_id, quantity, description } = parsed.data

  const { locationIds, locNameById } = await getTenantLocationContext(req, ctx)
  if (!locationIds.has(location_id)) {
    return res.status(404).json({ message: "stock location not found" })
  }

  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(inventory_item_id)) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  let created: any
  try {
    const { result } = await createReservationsWorkflow(req.scope).run({
      input: {
        reservations: [
          {
            inventory_item_id,
            location_id,
            quantity,
            description: description ?? undefined,
            created_by: ctx.merchant.email ?? ctx.merchant.id,
          },
        ],
      },
    })
    created = (result as any[])[0]
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to create reservation" })
  }

  const [hydrated] = await hydrateReservations(req, [created], locNameById)
  res.status(201).json({ reservation: hydrated })
}
