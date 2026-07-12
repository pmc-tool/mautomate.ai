import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import {
  TAKEABLE_HANDLER_MODES,
  actorName,
  loadConversation,
  marketing,
  serializeConversation,
  writeSystemMessage,
} from "../../_ops"

/** Postgres serialization failure (40001) — a concurrent writer beat us. */
const isSerializationFailure = (e: any): boolean => {
  const code = e?.code ?? e?.original?.code ?? e?.cause?.code
  if (code === "40001") return true
  const msg = String(e?.message ?? "").toLowerCase()
  return (
    msg.includes("could not serialize access") ||
    msg.includes("concurrent update")
  )
}

/**
 * POST /merchant/marketing/conversations/:id/take-over
 *
 * A human agent claims a thread from the AI. RACE-SAFE: the claim is a single
 * optimistic-locked conditional update — the row is only written when it is
 * still in a takeable handler_mode ("ai" or "queued"), and the read+write run
 * inside one "repeatable read" transaction, so two agents racing on the same
 * conversation cannot both win: the loser either matches zero rows or is aborted
 * by Postgres with a serialization failure. Either way it gets 409.
 *
 * Re-taking a thread you already hold is idempotent (200).
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

    // Optimistic lock: only claim a conversation still owned by the AI or
    // waiting in the handoff queue, and let the database arbitrate the race.
    let claimed: any[] = []
    try {
      const updated = await mk.updateMarketingConversations(
        {
          selector: {
            id,
            tenant_id: tenantId,
            handler_mode: [...TAKEABLE_HANDLER_MODES],
          },
          data: {
            handler_mode: "human",
            assigned_user_id: userId,
            handoff_reason: null,
          },
        } as any,
        { isolationLevel: "repeatable read" } as any
      )
      claimed = Array.isArray(updated) ? updated : updated ? [updated] : []
    } catch (e: any) {
      if (!isSerializationFailure(e)) throw e
      claimed = []
    }

    if (!claimed.length) {
      // Nothing was claimed: either another agent got here first, or we already
      // hold it (idempotent re-take).
      const current = await loadConversation(mk, id, tenantId)
      if (!current) {
        res.status(404).json({ message: `Conversation ${id} not found` })
        return
      }
      if (current.handler_mode === "human" && current.assigned_user_id === userId) {
        res.json({
          conversation: await serializeConversation(mk, id, tenantId, current),
        })
        return
      }
      res.status(409).json({
        message:
          "Another agent has already taken over this conversation. Refresh to see who is handling it.",
        code: "already_taken_over",
        conversation: await serializeConversation(mk, id, tenantId, current),
      })
      return
    }

    await writeSystemMessage(
      mk,
      tenantId,
      id,
      `${actorName(ctx)} took over this conversation.`
    )

    res.json({
      conversation: await serializeConversation(mk, id, tenantId, claimed[0]),
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to take over conversation",
    })
  }
}
