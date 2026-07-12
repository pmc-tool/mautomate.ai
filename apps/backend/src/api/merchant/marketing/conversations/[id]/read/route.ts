import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import { loadConversation, marketing, serializeConversation } from "../../_ops"

/**
 * POST /merchant/marketing/conversations/:id/read
 *
 * Mark a thread read (unread_count -> 0). The inbox list clears its badge with
 * this without having to load the whole thread. Idempotent.
 * Body: none. Response: { conversation }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk = marketing(req.scope)

    const conversation = await loadConversation(mk, id, tenantId)
    if (!conversation) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    if ((conversation.unread_count ?? 0) !== 0) {
      await mk.updateMarketingConversations({ id, unread_count: 0 } as any)
    }

    res.json({ conversation: await serializeConversation(mk, id, tenantId) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to mark conversation read",
    })
  }
}
