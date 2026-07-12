import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { linkCustomerGroupsToCustomerWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"
import { customerBelongsToTenant, findOwnedGroup } from "../../../_customer-helpers"

/**
 * POST /merchant/customers/:id/customer-groups
 *
 * Add/remove a tenant-owned customer to/from tenant-owned customer groups.
 * Every referenced group must belong to this tenant or the request is rejected.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  if (!(await customerBelongsToTenant(req, ctx, id))) {
    return res.status(404).json({ message: "customer not found" })
  }

  const body = (req.body || {}) as any
  const add: string[] = Array.isArray(body.add) ? body.add.filter(Boolean) : []
  const remove: string[] = Array.isArray(body.remove)
    ? body.remove.filter(Boolean)
    : []

  for (const gid of [...add, ...remove]) {
    const group = await findOwnedGroup(req, ctx.tenant.id, gid)
    if (!group) {
      return res.status(404).json({ message: `customer group ${gid} not found` })
    }
  }

  if (!add.length && !remove.length) return res.json({ ok: true })

  await linkCustomerGroupsToCustomerWorkflow(req.scope).run({
    input: { id, add, remove },
  })

  res.json({ ok: true })
}
