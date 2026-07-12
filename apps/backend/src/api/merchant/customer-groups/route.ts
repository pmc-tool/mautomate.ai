import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerGroupsWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/customer-groups
 *
 * Customer groups are global in Medusa; scope to this tenant via
 * metadata.tenant_id. Fail-closed: untagged/other-tenant rows are invisible.
 * Supports q/offset/limit.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer_group",
    filters: { metadata: { tenant_id: ctx.tenant.id } } as any,
    fields: ["id", "name", "metadata", "created_at", "updated_at"],
    pagination: { take: 500, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const owned = (data || []).filter(
    (g: any) => g.metadata?.tenant_id === ctx.tenant.id
  )

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const groupIds = owned.map((g: any) => g.id)
  const customerCounts: Record<string, number> = {}

  if (groupIds.length) {
    const memberships = await customerModule.listCustomerGroupCustomers(
      { customer_group_id: groupIds },
      { take: 10000 }
    )
    for (const m of memberships || []) {
      customerCounts[m.customer_group_id] =
        (customerCounts[m.customer_group_id] || 0) + 1
    }
  }

  const q = ((req.query.q as string) || "").trim().toLowerCase()
  const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0)
  const limitRaw = parseInt((req.query.limit as string) || "10", 10)
  const limit = Math.min(100, Math.max(1, isNaN(limitRaw) ? 10 : limitRaw))

  let groups = owned.map((g: any) => ({
    id: g.id,
    name: g.name,
    customer_count: customerCounts[g.id] || 0,
    customers_count: customerCounts[g.id] || 0,
    created_at: g.created_at,
    updated_at: g.updated_at,
  }))

  if (q) {
    groups = groups.filter((g) => (g.name || "").toLowerCase().includes(q))
  }

  const count = groups.length
  const paged = groups.slice(offset, offset + limit)

  res.json({ groups: paged, count })
}

/**
 * POST /merchant/customer-groups
 *
 * Create a customer group tagged with this tenant's id.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { name } = (req.body || {}) as { name?: string }
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "name is required" })
  }

  const { result } = await createCustomerGroupsWorkflow(req.scope).run({
    input: {
      customersData: [
        { name: name.trim(), metadata: { tenant_id: ctx.tenant.id } },
      ],
    },
  })
  const group = (result as any[])[0]

  res.status(201).json({
    group: {
      id: group.id,
      name: group.name,
      customer_count: 0,
      customers_count: 0,
      created_at: group.created_at,
      updated_at: group.updated_at,
    },
  })
}
