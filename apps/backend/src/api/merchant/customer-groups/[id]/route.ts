import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

async function findOwnedGroup(req: MedusaRequest, tenantId: string, id: string) {
  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const group = await customerModule.retrieveCustomerGroup(id).catch(() => null)
  if (!group || group.metadata?.tenant_id !== tenantId) return null
  return group
}

/**
 * GET /merchant/customer-groups/:id
 *
 * Only customer groups tagged with this tenant's metadata.tenant_id are
 * returned — other tenants' rows return 404.
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
    { take: 1000 }
  )

  res.json({
    group: {
      id: group.id,
      name: group.name,
      customer_count: (memberships || []).length,
      created_at: group.created_at,
      updated_at: group.updated_at,
    },
  })
}

/**
 * DELETE /merchant/customer-groups/:id
 *
 * Only customer groups tagged with this tenant's metadata.tenant_id can be
 * deleted — other tenants' rows return 404.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const group = await findOwnedGroup(req, ctx.tenant.id, id)
  if (!group) return res.status(404).json({ message: "customer group not found" })

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  await customerModule.deleteCustomerGroups([id])

  res.json({ id, object: "customer_group", deleted: true })
}
