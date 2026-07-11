import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

const SC = "sc_01KX1C5HVA682NARCW44M3TQJW"
const REGION = "reg_01KX1C5HYEMP21821H3T6K1KFT"
const CURRENCY = "usd"

/** Random spoken-friendly 6-digit code (100000-999999), unique within the SC. */
function genCode(used: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(100000 + Math.random() * 900000))
    if (!used.has(c)) {
      used.add(c)
      return c
    }
  }
  return String(Math.floor(100000 + Math.random() * 900000))
}

const NEW_ORDERS = [
  {
    email: "john@test.com",
    first: "John",
    last: "Smith",
    phone: "+61411222333",
    city: "Sydney",
    items: [{ title: "Aurora Ceramic Mug", quantity: 2, unit_price: 1800 }],
  },
  {
    email: "sarah@test.com",
    first: "Sarah",
    last: "Lee",
    phone: "+61422333444",
    city: "Melbourne",
    items: [{ title: "Nordic Wool Throw", quantity: 1, unit_price: 8900 }],
  },
  {
    email: "mike@test.com",
    first: "Mike",
    last: "Chen",
    phone: "+61433444555",
    city: "Brisbane",
    items: [{ title: "Terra Scented Candle", quantity: 3, unit_price: 2400 }],
  },
]

export default async function seedOrdersCodes({ container }: any) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule: any = container.resolve(Modules.ORDER)

  // Collect existing codes in this SC to avoid collisions.
  const { data: existing } = await query.graph({
    entity: "order",
    filters: { sales_channel_id: SC } as any,
    fields: ["id", "display_id", "email", "metadata"],
    pagination: { take: 500 },
  })
  const used = new Set<string>()
  for (const o of existing || []) {
    const c = (o.metadata as any)?.support_code
    if (c) used.add(String(c))
  }

  // 1. Backfill existing orders lacking a code.
  let backfilled = 0
  for (const o of existing || []) {
    if (!(o.metadata as any)?.support_code) {
      const code = genCode(used)
      await orderModule.updateOrders(o.id, {
        metadata: { ...(o.metadata || {}), support_code: code },
      })
      console.log(
        `[seed-codes] backfilled order display_id=${o.display_id} email=${o.email} -> code ${code}`
      )
      backfilled++
    }
  }

  // 2. Create new test orders, each with a code.
  const created: any[] = []
  for (const spec of NEW_ORDERS) {
    // Skip if an order with this email already exists in the SC.
    if ((existing || []).some((o: any) => o.email === spec.email)) continue
    const code = genCode(used)
    try {
      const order = await orderModule.createOrders({
        region_id: REGION,
        currency_code: CURRENCY,
        sales_channel_id: SC,
        email: spec.email,
        metadata: { support_code: code },
        shipping_address: {
          first_name: spec.first,
          last_name: spec.last,
          address_1: "1 Test St",
          city: spec.city,
          province: "NSW",
          postal_code: "2000",
          country_code: "au",
          phone: spec.phone,
        },
        items: spec.items,
      })
      const o = Array.isArray(order) ? order[0] : order
      created.push({
        display_id: o.display_id,
        email: spec.email,
        phone: spec.phone,
        code,
      })
      console.log(
        `[seed-codes] created order display_id=${o.display_id} ${spec.email} phone=${spec.phone} code=${code}`
      )
    } catch (e: any) {
      console.error(`[seed-codes] failed to create ${spec.email}:`, e?.message)
    }
  }

  console.log(
    "[seed-codes] DONE",
    JSON.stringify({ backfilled, created: created.length, orders: created })
  )
}
