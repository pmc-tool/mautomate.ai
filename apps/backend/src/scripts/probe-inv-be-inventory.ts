import {
  createInventoryItemsWorkflow,
  updateInventoryItemsWorkflow,
  deleteInventoryItemWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  deleteInventoryLevelsWorkflow,
  createReservationsWorkflow,
  updateReservationsWorkflow,
  deleteReservationsWorkflow,
} from "@medusajs/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Non-destructive probe: verifies the workflows the routes depend on exist and
// are callable, and that the graph fields + inventory module list methods the
// routes read are available. Runs ZERO mutations.
export default async function ({ container }) {
  const results: string[] = []

  const workflows: Record<string, unknown> = {
    createInventoryItemsWorkflow,
    updateInventoryItemsWorkflow,
    deleteInventoryItemWorkflow,
    createInventoryLevelsWorkflow,
    updateInventoryLevelsWorkflow,
    deleteInventoryLevelsWorkflow,
    createReservationsWorkflow,
    updateReservationsWorkflow,
    deleteReservationsWorkflow,
  }
  for (const [name, fn] of Object.entries(workflows)) {
    if (typeof fn !== "function") {
      throw new Error(`workflow missing or not a function: ${name}`)
    }
    results.push(`workflow ok: ${name}`)
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Graph field probes used by the routes (read-only).
  await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    pagination: { take: 1, skip: 0 },
  })
  results.push("graph ok: product_variant_inventory_item")

  await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "sku", "product.title", "product.thumbnail"],
    pagination: { take: 1, skip: 0 },
  })
  results.push("graph ok: product_variant -> product")

  // order_display_id resolution path is best-effort in the routes; probe reports.
  try {
    await query.graph({
      entity: "order_line_item",
      fields: ["id", "order.id", "order.display_id"],
      pagination: { take: 1, skip: 0 },
    })
    results.push("graph ok: order_line_item -> order.display_id")
  } catch (e: any) {
    results.push(
      `graph WARN: order_line_item -> order.display_id unavailable (order_display_id will be omitted): ${e?.message}`
    )
  }

  const inventoryModule: any = container.resolve(Modules.INVENTORY)
  await inventoryModule.listInventoryItems({}, { take: 1 })
  await inventoryModule.listInventoryLevels({}, { take: 1 })
  await inventoryModule.listReservationItems({}, { take: 1 })
  results.push("inventory module list methods ok (items, levels, reservations)")

  console.log(JSON.stringify(results, null, 2))
  return results
}