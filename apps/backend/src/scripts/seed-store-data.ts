import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/core-flows"

const TENANT_ID = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const SC = "sc_01KX1C5HVA682NARCW44M3TQJW"
const REGION = "reg_01KX1C5HYEMP21821H3T6K1KFT"
const CURRENCY = "usd"

const CATALOG = [
  {
    title: "Aurora Ceramic Mug",
    handle: "ava-aurora-ceramic-mug",
    price: 1800,
    description:
      "A hand-glazed stoneware mug that holds 350ml, dishwasher and microwave safe.",
  },
  {
    title: "Nordic Wool Throw",
    handle: "ava-nordic-wool-throw",
    price: 8900,
    description:
      "A 130 by 170cm throw woven from 100% lambswool, warm and breathable.",
  },
  {
    title: "Terra Scented Candle",
    handle: "ava-terra-scented-candle",
    price: 2400,
    description:
      "A 220g soy-wax candle with cedar and amber notes, about 45 hours burn time.",
  },
]

export default async function seedStoreData({ container }: any) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryModule: any = container.resolve(Modules.INVENTORY)
  const orderModule: any = container.resolve(Modules.ORDER)
  const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)

  // Reuse the tenant's existing stock location (provisioning stamps
  // metadata.tenant_id on it).
  let locId: string | undefined
  try {
    const locs = await stockLocationModule.listStockLocations({}, { take: 500 })
    const mine = (locs || []).find(
      (l: any) => l?.metadata?.tenant_id === TENANT_ID
    )
    locId = mine?.id
  } catch (e) {
    // non-fatal — inventory levels just get skipped
  }
  console.log("[seed] stock location:", locId)

  // Skip products that already exist (idempotent on re-run).
  const { data: existing } = await query.graph({
    entity: "product",
    filters: { handle: CATALOG.map((c) => c.handle) } as any,
    fields: ["id", "handle"],
  })
  const have = new Set((existing || []).map((p: any) => p.handle))
  const toCreate = CATALOG.filter((c) => !have.has(c.handle))

  let createdProducts: any[] = []
  if (toCreate.length) {
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: toCreate.map((c) => ({
          title: c.title,
          handle: c.handle,
          description: c.description,
          status: "published" as any,
          sales_channels: [{ id: SC }],
          options: [{ title: "Default", values: ["Default"] }],
          variants: [
            {
              title: "Default",
              prices: [{ amount: c.price, currency_code: CURRENCY }],
              options: { Default: "Default" },
            },
          ],
        })),
      },
    })
    createdProducts = result as any[]

    // Inventory levels at the tenant location for the new variants.
    if (locId) {
      const variantIds = createdProducts
        .flatMap((p) => p.variants ?? [])
        .map((v: any) => v.id)
        .filter(Boolean)
      if (variantIds.length) {
        const { data: vlinks } = await query.graph({
          entity: "product_variant_inventory_item",
          filters: { variant_id: variantIds } as any,
          fields: ["inventory_item_id"],
        })
        for (const l of vlinks || []) {
          if (!l.inventory_item_id) continue
          await inventoryModule
            .createInventoryLevels([
              {
                inventory_item_id: l.inventory_item_id,
                location_id: locId,
                stocked_quantity: 500,
              },
            ])
            .catch(() => {})
        }
      }
    }
  }
  console.log("[seed] products created:", createdProducts.length)

  // One order in this tenant's sales channel so order-lookup has a real hit.
  let orderInfo = "skipped (already present)"
  const { data: existingOrders } = await query.graph({
    entity: "order",
    filters: { sales_channel_id: SC, email: "ava.demo@example.com" } as any,
    fields: ["id", "display_id"],
  })
  if (!existingOrders?.length) {
    try {
      const order = await orderModule.createOrders({
        region_id: REGION,
        currency_code: CURRENCY,
        sales_channel_id: SC,
        email: "ava.demo@example.com",
        shipping_address: {
          first_name: "Alex",
          last_name: "Demo",
          address_1: "12 Harbour St",
          city: "Sydney",
          province: "NSW",
          postal_code: "2000",
          country_code: "au",
          phone: "+61400111222",
        },
        items: [
          {
            title: "Aurora Ceramic Mug",
            quantity: 2,
            unit_price: 1800,
          },
          {
            title: "Terra Scented Candle",
            quantity: 1,
            unit_price: 2400,
          },
        ],
      })
      const o = Array.isArray(order) ? order[0] : order
      orderInfo = `created ${o.id} display_id=${o.display_id}`
    } catch (e: any) {
      orderInfo = `order create FAILED: ${e?.message ?? e}`
    }
  }
  console.log("[seed] order:", orderInfo)
  console.log(
    "[seed] DONE",
    JSON.stringify({
      products_created: createdProducts.length,
      order: orderInfo,
      tenant: TENANT_ID,
    })
  )
}
