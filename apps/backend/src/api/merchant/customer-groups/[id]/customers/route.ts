import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkCustomersToCustomerGroupWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"
import {
  findOwnedGroup,
  customerBelongsToTenant,
} from "../../../_customer-helpers"

/**
 * GET /merchant/customer-groups/:id/customers
 *
 * Paginated member list of a tenant-owned group. Supports q/offset/limit.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  const group = await findOwnedGroup(req, ctx.tenant.id, id)
  if (!group) return res.status(404).json({ message: "customer group not found" })

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const memberships = await customerModule.listCustomerGroupCustomers(
    { customer_group_id: [id] },
    { take: 10000 }
  )
  const customerIds = Array.from(
    new Set((memberships || []).map((m: any) => m.customer_id).filter(Boolean))
  ) as string[]

  if (!customerIds.length) return res.json({ customers: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    filters: { id: customerIds } as any,
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "has_account",
      "created_at",
    ],
    pagination: { take: 10000, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const q = ((req.query.q as string) || "").trim().toLowerCase()
  const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0)
  const limitRaw = parseInt((req.query.limit as string) || "10", 10)
  const limit = Math.min(100, Math.max(1, isNaN(limitRaw) ? 10 : limitRaw))

  let rows = (data || []).map((c: any) => ({
    id: c.id,
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    has_account: !!c.has_account,
    created_at: c.created_at,
  }))

  if (q) {
    rows = rows.filter((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase()
      return (c.email || "").toLowerCase().includes(q) || name.includes(q)
    })
  }

  const count = rows.length
  const paged = rows.slice(offset, offset + limit)

  res.json({ customers: paged, count })
}

/**
 * POST /merchant/customer-groups/:id/customers
 *
 * Batch add/remove members of a tenant-owned group. Every customer being added
 * must be tenant-visible or the request is rejected (fail-closed).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  const group = await findOwnedGroup(req, ctx.tenant.id, id)
  if (!group) return res.status(404).json({ message: "customer group not found" })

  const body = (req.body || {}) as any
  const add: string[] = Array.isArray(body.add) ? body.add.filter(Boolean) : []
  const remove: string[] = Array.isArray(body.remove)
    ? body.remove.filter(Boolean)
    : []

  for (const cid of add) {
    if (!(await customerBelongsToTenant(req, ctx, cid))) {
      return res.status(404).json({ message: `customer ${cid} not found` })
    }
  }

  if (!add.length && !remove.length) return res.json({ ok: true })

  await linkCustomersToCustomerGroupWorkflow(req.scope).run({
    input: { id, add, remove },
  })

  res.json({ ok: true })
}
