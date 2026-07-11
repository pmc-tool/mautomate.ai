import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductVariantsWorkflow,
  deleteProductVariantsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/core-flows"

/**
 * Non-destructive probe for the be-variants backend routes: validates every
 * workflow import and every query.graph / module field path the new routes
 * depend on. Read-only: no writes, no workflow runs.
 */
export default async function probeVariantsBackend({ container }: { container: any }) {
  const failures: string[] = []
  const ok = (msg: string) => console.log(`OK ${msg}`)
  const fail = (msg: string, e: any) => {
    failures.push(msg)
    console.error(`FAIL ${msg}: ${e?.message || e}`)
  }

  // 1. Workflow exports (construct an executor, never run it).
  const workflows: Record<string, any> = {
    createProductVariantsWorkflow,
    updateProductVariantsWorkflow,
    deleteProductVariantsWorkflow,
    createInventoryLevelsWorkflow,
    updateInventoryLevelsWorkflow,
    updateProductsWorkflow,
  }
  for (const [name, wf] of Object.entries(workflows)) {
    try {
      if (typeof wf !== "function") {
        throw new Error(`export is ${typeof wf}, expected function`)
      }
      const instance = wf(container)
      if (typeof instance?.run !== "function") {
        throw new Error("workflow instance has no run()")
      }
      ok(`workflow export ${name}`)
    } catch (e: any) {
      fail(`workflow export ${name}`, e)
    }
  }

  // 2. query.graph entity + field paths used by the routes.
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const graphChecks: { entity: string; fields: string[] }[] = [
    {
      entity: "product",
      fields: ["id", "title", "thumbnail", "variants.id", "variants.title", "variants.sku"],
    },
    { entity: "product_sales_channel", fields: ["product_id", "sales_channel_id"] },
    { entity: "product_variant", fields: ["id", "product_id", "title", "sku"] },
    { entity: "product_variant_inventory_item", fields: ["variant_id", "inventory_item_id"] },
  ]
  for (const check of graphChecks) {
    try {
      await query.graph({
        entity: check.entity,
        fields: check.fields,
        pagination: { take: 1, skip: 0 },
      })
      ok(`query.graph ${check.entity} [${check.fields.join(", ")}]`)
    } catch (e: any) {
      fail(`query.graph ${check.entity}`, e)
    }
  }

  // 3. Filter shapes used for ownership checks (nonexistent ids: read-only).
  try {
    await query.graph({
      entity: "product_variant",
      filters: { id: "variant_probe_nonexistent", product_id: "prod_probe_nonexistent" },
      fields: ["id"],
    })
    ok("query.graph product_variant filtered by id + product_id")
  } catch (e: any) {
    fail("query.graph product_variant filtered by id + product_id", e)
  }
  try {
    await query.graph({
      entity: "product_sales_channel",
      filters: { sales_channel_id: "sc_probe_nonexistent", product_id: "prod_probe_nonexistent" },
      fields: ["product_id"],
    })
    ok("query.graph product_sales_channel filtered by sales_channel_id + product_id")
  } catch (e: any) {
    fail("query.graph product_sales_channel filtered", e)
  }

  // 4. Module reads used by the stock + media + option-validation paths.
  try {
    const inventoryModule: any = container.resolve(Modules.INVENTORY)
    await inventoryModule.listInventoryLevels({}, { take: 1 })
    ok("inventory.listInventoryLevels")
  } catch (e: any) {
    fail("inventory.listInventoryLevels", e)
  }
  try {
    const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)
    await stockLocationModule.listStockLocations({}, { take: 1 })
    ok("stock_location.listStockLocations")
  } catch (e: any) {
    fail("stock_location.listStockLocations", e)
  }
  try {
    const productModule: any = container.resolve(Modules.PRODUCT)
    const [p] = await productModule.listProducts(
      {},
      { relations: ["options", "options.values", "images"], take: 1 }
    )
    if (p) {
      const opt = (p.options || [])[0]
      if (opt && !Array.isArray(opt.values)) {
        throw new Error("product option has no values array")
      }
    }
    ok("product.listProducts with options/options.values/images relations")
  } catch (e: any) {
    fail("product.listProducts relations", e)
  }

  if (failures.length) {
    throw new Error(`probe failed (${failures.length}): ${failures.join("; ")}`)
  }
  console.log("ALL PROBES PASSED")
}