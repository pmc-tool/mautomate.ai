import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import {
  loadConversation,
  marketing,
  serializeConversation,
  writeSystemMessage,
} from "../../_ops"

/**
 * POST /merchant/marketing/conversations/:id/return-to-ai
 *
 * Hand a thread back to the AI assistant. A thread a human holds may only be
 * released by the agent it is assigned to — anyone else gets 403, so an agent
 * cannot yank a live conversation out from under a colleague. A thread nobody
 * has claimed yet (queued, unassigned) may be returned by any agent of the
 * store: cancelling a pending handoff takes it from no one.
 *
 * Body: none. Response: { conversation }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const userId = ctx.merchant.id
  const { id } = req.params

  try {
    const mk = marketing(req.scope)

    const conversation = await loadConversation(mk, id, tenantId)
    if (!conversation) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    if (conversation.handler_mode === "ai") {
      // Already with the AI — nothing to release.
      res.json({
        conversation: await serializeConversation(mk, id, tenantId, conversation),
      })
      return
    }

    if (
      conversation.assigned_user_id &&
      conversation.assigned_user_id !== userId
    ) {
      res.status(403).json({
        message:
          "This conversation is assigned to another agent. Only the assigned agent can return it to the AI assistant.",
        code: "not_assigned",
      })
      return
    }

    await mk.updateMarketingConversations({
      id,
      handler_mode: "ai",
      assigned_user_id: null,
      handoff_reason: null,
    } as any)

    await writeSystemMessage(
      mk,
      tenantId,
      id,
      "Conversation returned to the AI assistant."
    )

    res.json({ conversation: await serializeConversation(mk, id, tenantId) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to return conversation to the AI",
    })
  }
}
