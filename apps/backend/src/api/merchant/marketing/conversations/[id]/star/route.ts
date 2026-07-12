import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import { loadConversation, marketing, serializeConversation } from "../../_ops"

/**
 * POST /merchant/marketing/conversations/:id/star
 *
 * Star / unstar a thread.
 * Body: { starred: boolean } sets it explicitly; an empty body toggles the
 * current value (what the star button in the inbox sends).
 * Response: { conversation }
 *
 * No system message: starring is a private, per-inbox flag, not a state change
 * anyone in the thread should see.
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

    const body = (req.body ?? {}) as { starred?: unknown }
    const provided = body.starred !== undefined
    if (provided && typeof body.starred !== "boolean") {
      res.status(400).json({ message: "starred must be a boolean" })
      return
    }

    const starred = provided
      ? (body.starred as boolean)
      : !Boolean(conversation.starred)

    await mk.updateMarketingConversations({ id, starred } as any)

    res.json({ conversation: await serializeConversation(mk, id, tenantId) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update conversation",
    })
  }
}
