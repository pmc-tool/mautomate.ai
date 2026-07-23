import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"
import { getNumberProvider } from "../../../../../modules/call-center/telephony-providers"

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

/** DELETE — release a number (at the carrier too, when we bought it there). */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id
  const { id } = req.params

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await loadOwned(cc, id, tenant_id, res)
    if (!row) return

    // Numbers bought THROUGH the platform (provider_number_id set) must be
    // released at the carrier or the platform keeps paying for them. BYO
    // registrations (provider_number_id null) are never touched at the carrier.
    let carrier_released: boolean | null = null
    if (row.provider_number_id) {
      const provider = getNumberProvider(row.provider)
      if (provider?.isConfigured()) {
        const released = await provider.release(
          row.provider_number_id,
          row.e164,
          row.country || "US"
        )
        carrier_released = released.ok
        if (!released.ok) {
          // Keep the row so the operator can retry — a silently-kept DID is a
          // recurring carrier bill with no owner.
          return res.status(502).json({
            message: `The carrier refused to release ${row.e164} (${released.error}). Nothing was deleted — try again or contact support.`,
          })
        }
      }
    }

    await cc.deletePhoneNumbers(id)
    res.json({ id, deleted: true, carrier_released })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to delete number" })
  }
}
