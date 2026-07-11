import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "customer not found" })

  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Ownership is derived from order history, exactly like the LIST route:
  // a customer belongs to this tenant only if they have an order in this
  // tenant's sales channel. Pull those orders FIRST — if there are none the
  // customer is out of scope and we 404 before touching any PII.
  const { data: ordersData } = await query.graph({
    entity: "order",
    filters: { customer_id: id, sales_channel_id: scId } as any,
    fields: [
      "id",
      "display_id",
      "status",
      "payment_status",
      "fulfillment_status",
      "total",
      "currency_code",
      "created_at",
    ],
    pagination: { take: 50, skip: 0, order: { created_at: "DESC" } } as any,
  })

  if (!(ordersData || []).length) {
    return res.status(404).json({ message: "customer not found" })
  }

  const { data: customerData } = await query.graph({
    entity: "customer",
    filters: { id } as any,
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "phone",
      "created_at",
      "addresses.*",
      "groups.id",
      "groups.name",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const customer: any = (customerData || [])[0]
  if (!customer) return res.status(404).json({ message: "customer not found" })

  const shippingAddresses = (customer.addresses || []).filter((a: any) => a.address_type === "shipping")
  const billingAddresses = (customer.addresses || []).filter((a: any) => a.address_type === "billing")

  const orders = (ordersData || []).map((o: any) => ({
    id: o.id,
    display_id: o.display_id,
    status: o.status,
    payment_status: o.payment_status,
    fulfillment_status: o.fulfillment_status,
    total: Number(o.total ?? 0),
    currency_code: o.currency_code,
    created_at: o.created_at,
    customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined,
  }))

  res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      created_at: customer.created_at,
      status: "active",
      shipping_addresses: shippingAddresses.map((a: any) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        address_1: a.address_1,
        address_2: a.address_2,
        city: a.city,
        province: a.province,
        postal_code: a.postal_code,
        country_code: a.country_code,
        phone: a.phone,
      })),
      billing_addresses: billingAddresses.map((a: any) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        address_1: a.address_1,
        address_2: a.address_2,
        city: a.city,
        province: a.province,
        postal_code: a.postal_code,
        country_code: a.country_code,
        phone: a.phone,
      })),
      groups: (customer.groups || []).map((g: any) => ({ id: g.id, name: g.name })),
      orders,
    },
  })
}
