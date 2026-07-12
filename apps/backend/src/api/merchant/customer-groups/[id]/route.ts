import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  updateCustomerGroupsWorkflow,
  deleteCustomerGroupsWorkflow,
} from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"
import { findOwnedGroup } from "../../_customer-helpers"

/**
 * GET /merchant/customer-groups/:id
 *
 * Only groups tagged with this tenant's metadata.tenant_id are returned.
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

  res.json({
    group: {
      id: group.id,
      name: group.name,
      customer_count: (memberships || []).length,
      customers_count: (memberships || []).length,
      created_at: group.created_at,
      updated_at: group.updated_at,
      metadata: group.metadata ?? null,
    },
  })
}

/**
 * POST /merchant/customer-groups/:id
 *
 * Update a tenant-owned group. Metadata edits preserve the tenant_id tag.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  const group = await findOwnedGroup(req, ctx.tenant.id, id)
  if (!group) return res.status(404).json({ message: "customer group not found" })

  const body = (req.body || {}) as any
  const update: any = {}
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim()
  }
  if ("metadata" in body) {
    const meta =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {}
    update.metadata = { ...meta, tenant_id: ctx.tenant.id }
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ message: "no updatable fields provided" })
  }

  const { result } = await updateCustomerGroupsWorkflow(req.scope).run({
    input: { selector: { id }, update },
  })
  const updated = Array.isArray(result) ? result[0] : result

  res.json({
    group: {
      id: updated?.id ?? group.id,
      name: updated?.name ?? update.name ?? group.name,
      created_at: updated?.created_at ?? group.created_at,
      updated_at: updated?.updated_at ?? group.updated_at,
      metadata: updated?.metadata ?? update.metadata ?? group.metadata ?? null,
    },
  })
}

/**
 * DELETE /merchant/customer-groups/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  const group = await findOwnedGroup(req, ctx.tenant.id, id)
  if (!group) return res.status(404).json({ message: "customer group not found" })

  await deleteCustomerGroupsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "customer_group", deleted: true })
}
