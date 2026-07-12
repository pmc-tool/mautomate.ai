export default async function ({ container }) {
  const query = container.resolve("query")

  const { data: groups } = await query.graph({
    entity: "customer_group",
    fields: ["id", "name", "metadata", "customers.id"],
    pagination: { take: 5, skip: 0 },
  })
  console.log(
    "customer_group sample:",
    JSON.stringify((groups || []).slice(0, 3), null, 2)
  )

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account", "metadata", "addresses.id"],
    pagination: { take: 5, skip: 0 },
  })
  console.log(
    "customer sample:",
    JSON.stringify((customers || []).slice(0, 3), null, 2)
  )
  console.log("customer count fetched (list default now returns up to 1000):", (customers || []).length)

  // Validates the fields used by the tenant-safe DELETE guard (orders outside
  // the tenant's sales channel block deletion). Read-only.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "sales_channel_id"],
    pagination: { take: 5, skip: 0 },
  })
  console.log(
    "order sample (customer_id/sales_channel_id resolve):",
    JSON.stringify((orders || []).slice(0, 3), null, 2)
  )
}