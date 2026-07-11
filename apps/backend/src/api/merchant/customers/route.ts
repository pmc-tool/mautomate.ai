import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/customers
 *
 * List customers who have placed orders in this tenant's sales channel.
 * Customers are global in Medusa; tenant-scoping is derived from order
 * ownership so a merchant never sees another tenant's shoppers.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ customers: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Find orders in this tenant's sales channel.
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { sales_channel_id: scId } as any,
    fields: ["customer_id"],
    pagination: { take: 1000, skip: 0 } as any,
  })

  const customerIds = Array.from(
    new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean))
  ) as string[]

  if (!customerIds.length) return res.json({ customers: [], count: 0 })

  // 2. Fetch the customer records.
  const { data } = await query.graph({
    entity: "customer",
    filters: { id: customerIds } as any,
    fields: ["id", "email", "first_name", "last_name", "phone", "created_at"],
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const customers = (data || []).map((c: any) => ({
    id: c.id,
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    created_at: c.created_at,
  }))

  res.json({ customers, count: customers.length })
}
