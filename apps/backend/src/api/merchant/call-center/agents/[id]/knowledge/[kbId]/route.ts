import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../../../modules/call-center/service"
import { resolveMerchant } from "../../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * DELETE /merchant/call-center/agents/:id/knowledge/:kbId
 *
 * Remove a knowledge-base entry from an agent. Fail-closed and null-safe: the
 * entry must belong to BOTH the caller's tenant AND the given agent, else 404.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id, kbId } = req.params

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const entry = await (cc as any)
      .retrieveKnowledgeEntry(kbId)
      .catch(() => null)
    if (
      !entry ||
      entry.tenant_id !== tenant_id ||
      entry.agent_id !== id
    ) {
      return res
        .status(404)
        .json({ message: `Knowledge ${kbId} was not found` })
    }

    await (cc as any).deleteKnowledgeEntries(kbId)

    res.json({ id: kbId, object: "call_center_knowledge", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete knowledge",
    })
  }
}
