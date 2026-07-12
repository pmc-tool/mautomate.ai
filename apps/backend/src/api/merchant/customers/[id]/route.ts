import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateCustomersWorkflow,
  deleteCustomersWorkflow,
} from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"
import { customerBelongsToTenant } from "../../_customer-helpers"

/**
 * GET /merchant/customers/:id
 *
 * Full customer detail. Ownership is fail-closed: the customer must either be
 * tagged with this tenant's id or have an order in this tenant's sales channel.
 * Only groups that belong to this tenant are surfaced.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customerData } = await query.graph({
    entity: "customer",
    filters: { id } as any,
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "company_name",
      "phone",
      "has_account",
      "created_at",
      "updated_at",
      "metadata",
      "addresses.*",
      "groups.id",
      "groups.name",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })
  const customer: any = (customerData || [])[0]
  if (!customer) return res.status(404).json({ message: "customer not found" })

  const ownedByTag = customer.metadata?.tenant_id === ctx.tenant.id

  // Orders in this tenant's sales channel — also drives the Orders card and, if
  // present, confirms ownership for legacy (untagged) shoppers.
  let ordersData: any[] = []
  if (scId) {
    const { data } = await query.graph({
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
    ordersData = data || []
  }

  if (!ownedByTag && !ordersData.length) {
    return res.status(404).json({ message: "customer not found" })
  }

  // Fail-closed group membership: only tenant-owned groups are surfaced.
  let groups: { id: string; name: string; customers_count: number }[] = []
  const groupIds = (customer.groups || []).map((g: any) => g.id).filter(Boolean)
  if (groupIds.length) {
    const { data: grpData } = await query.graph({
      entity: "customer_group",
      filters: { id: groupIds } as any,
      fields: ["id", "name", "metadata", "customers.id"],
      pagination: { take: groupIds.length, skip: 0 } as any,
    })
    groups = (grpData || [])
      .filter((g: any) => g.metadata?.tenant_id === ctx.tenant.id)
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        customers_count: (g.customers || []).length,
      }))
  }

  const addresses = (customer.addresses || []).map((a: any) => ({
    id: a.id,
    address_name: a.address_name,
    first_name: a.first_name,
    last_name: a.last_name,
    company: a.company,
    address_1: a.address_1,
    address_2: a.address_2,
    city: a.city,
    province: a.province,
    postal_code: a.postal_code,
    country_code: a.country_code,
    phone: a.phone,
    is_default_shipping: !!a.is_default_shipping,
    is_default_billing: !!a.is_default_billing,
  }))

  const customer_name =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined

  const orders = ordersData.map((o: any) => ({
    id: o.id,
    display_id: o.display_id,
    status: o.status,
    payment_status: o.payment_status,
    fulfillment_status: o.fulfillment_status,
    total: Number(o.total ?? 0),
    currency_code: o.currency_code,
    created_at: o.created_at,
    customer_name,
  }))

  res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      company_name: customer.company_name,
      phone: customer.phone,
      has_account: !!customer.has_account,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
      metadata: customer.metadata ?? null,
      status: "active",
      addresses,
      // Back-compat: the previous detail response exposed these two keys. The
      // canonical list is `addresses`; consumers should prefer it.
      shipping_addresses: addresses,
      billing_addresses: [],
      groups,
      orders,
    },
  })
}

/**
 * POST /merchant/customers/:id
 *
 * Update a tenant-owned customer. Email is never changed for registered
 * customers. Metadata edits always preserve the tenant_id ownership tag.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  if (!(await customerBelongsToTenant(req, ctx, id))) {
    return res.status(404).json({ message: "customer not found" })
  }

  const body = (req.body || {}) as any
  const update: any = {}

  for (const k of ["first_name", "last_name", "company_name", "phone"]) {
    if (k in body) update[k] = body[k] === "" ? null : body[k]
  }

  if ("metadata" in body) {
    const meta =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {}
    update.metadata = { ...meta, tenant_id: ctx.tenant.id }
  }

  if ("email" in body && body.email) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "customer",
      filters: { id } as any,
      fields: ["id", "has_account"],
      pagination: { take: 1, skip: 0 } as any,
    })
    const existing: any = (data || [])[0]
    if (existing && !existing.has_account) {
      update.email = String(body.email).trim()
    }
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ message: "no updatable fields provided" })
  }

  try {
    const { result } = await updateCustomersWorkflow(req.scope).run({
      input: { selector: { id }, update },
    })
    const customer = Array.isArray(result) ? result[0] : result
    return res.json({ customer })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to update customer" })
  }
}

/**
 * DELETE /merchant/customers/:id
 *
 * Tenant-safe hard delete. Customers are global records in Medusa, so a blind
 * delete could destroy another tenant's shopper. Fail-closed rules:
 *  - only customers this tenant CREATED (metadata.tenant_id === tenant.id) are
 *    deletable; order-derived legacy shoppers 404 here even though they are
 *    visible in the list/detail views.
 *  - if the customer has ANY order outside this tenant's sales channel
 *    (including orders with no sales channel), the delete is refused with 409.
 * Orders inside the tenant's own channel do not block deletion (they are the
 * tenant's own data; order records survive customer soft-deletion).
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params
  const scId = ctx.tenant.meta?.sales_channel_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customerData } = await query.graph({
    entity: "customer",
    filters: { id } as any,
    fields: ["id", "metadata"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const customer: any = (customerData || [])[0]
  if (!customer || customer.metadata?.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({ message: "customer not found" })
  }

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { customer_id: id } as any,
    fields: ["id", "sales_channel_id"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  const hasForeignOrder = (orders || []).some(
    (o: any) => !scId || o.sales_channel_id !== scId
  )
  if (hasForeignOrder) {
    return res.status(409).json({
      message:
        "this customer has orders outside your store and cannot be deleted",
    })
  }

  try {
    await deleteCustomersWorkflow(req.scope).run({ input: { ids: [id] } })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to delete customer" })
  }

  res.json({ id, object: "customer", deleted: true })
}
