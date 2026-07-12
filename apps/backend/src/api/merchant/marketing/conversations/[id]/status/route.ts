import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import {
  CONVERSATION_STATUSES,
  actorName,
  loadConversation,
  marketing,
  serializeConversation,
  writeSystemMessage,
} from "../../_ops"

const STATUS_COPY: Record<string, string> = {
  open: "reopened this conversation",
  snoozed: "snoozed this conversation",
  closed: "closed this conversation",
}

/**
 * POST /merchant/marketing/conversations/:id/status
 *
 * Move a thread through the inbox workflow.
 * Body: { status: "open" | "snoozed" | "closed" } — validated against the
 * marketing_conversation.status enum; anything else is a 400.
 * Response: { conversation }
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

    const body = (req.body ?? {}) as { status?: unknown }
    const status = typeof body.status === "string" ? body.status.trim() : ""
    if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({
        message: `status must be one of: ${CONVERSATION_STATUSES.join(", ")}`,
      })
      return
    }

    if (conversation.status === status) {
      res.json({
        conversation: await serializeConversation(mk, id, tenantId, conversation),
      })
      return
    }

    await mk.updateMarketingConversations({ id, status } as any)

    await writeSystemMessage(
      mk,
      tenantId,
      id,
      `${actorName(ctx)} ${STATUS_COPY[status]}.`
    )

    res.json({ conversation: await serializeConversation(mk, id, tenantId) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update conversation status",
    })
  }
}
