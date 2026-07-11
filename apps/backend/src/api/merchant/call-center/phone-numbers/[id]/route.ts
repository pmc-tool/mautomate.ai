import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"

/**
 * /merchant/call-center/phone-numbers/:id
 *
 * Update (bind agent / activate) or delete one number. STRICTLY tenant-scoped:
 * the row is loaded and its tenant_id asserted equal to the caller's before any
 * mutation — a merchant can never touch another tenant's number.
 */

const loadOwned = async (
  cc: any,
  id: string,
  tenant_id: string,
  res: MedusaResponse
): Promise<any | null> => {
  const row = await cc.retrievePhoneNumber(id).catch(() => null)
  if (!row || row.tenant_id !== tenant_id) {
    res.status(404).json({ message: "Number not found for this store." })
    return null
  }
  return row
}

/** PATCH — bind an agent, relabel, or toggle active. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id
  const { id } = req.params

  const body = (req.body ?? {}) as Record<string, unknown>
  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await loadOwned(cc, id, tenant_id, res)
    if (!row) return

    const patch: Record<string, unknown> = { id }
    if (typeof body.label === "string") patch.label = body.label.trim() || null
    if (typeof body.active === "boolean") patch.active = body.active
    if (typeof body.agent_id === "string") {
      const agent_id = body.agent_id.trim() || null
      if (agent_id) {
        const agent = await cc.retrievePlaybook(agent_id).catch(() => null)
        if (!agent || agent.tenant_id !== tenant_id) {
          return res
            .status(404)
            .json({ message: "Agent not found for this store." })
        }
      }
      patch.agent_id = agent_id
    }

    const updated = await cc.updatePhoneNumbers(patch)
    res.json({ phone_number: updated })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to update number" })
  }
}

/** DELETE — release a number. */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id
  const { id } = req.params

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await loadOwned(cc, id, tenant_id, res)
    if (!row) return
    await cc.deletePhoneNumbers(id)
    res.json({ id, deleted: true })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to delete number" })
  }
}
