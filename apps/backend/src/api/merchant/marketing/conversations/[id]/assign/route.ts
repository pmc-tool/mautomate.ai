import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import {
  actorName,
  loadConversation,
  marketing,
  serializeConversation,
  writeSystemMessage,
} from "../../_ops"

/**
 * POST /merchant/marketing/conversations/:id/assign
 *
 * Route a thread to a human teammate, or unassign it back to the AI.
 *   { assigned_user_id: "<merchant id>" } -> handler_mode "human", assigned
 *   { assigned_user_id: null }            -> handler_mode "ai", unassigned
 *
 * The assignee must be an active merchant user of THIS tenant — assigning a
 * foreign or unknown user is rejected (400), never silently stored.
 *
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

    const body = (req.body ?? {}) as { assigned_user_id?: string | null }
    if (!("assigned_user_id" in body)) {
      res.status(400).json({
        message: "assigned_user_id is required (a merchant user id, or null to unassign)",
      })
      return
    }

    const raw = body.assigned_user_id
    if (raw !== null && typeof raw !== "string") {
      res.status(400).json({
        message: "assigned_user_id must be a merchant user id or null",
      })
      return
    }
    const assignee = typeof raw === "string" ? raw.trim() : null
    if (raw !== null && !assignee) {
      res.status(400).json({
        message: "assigned_user_id must be a merchant user id or null",
      })
      return
    }

    let assigneeName: string | null = null
    if (assignee) {
      const user = await ctx.svc.retrieveMerchant(assignee).catch(() => null)
      if (!user || user.tenant_id !== tenantId || user.status !== "active") {
        res.status(400).json({
          message: `${assignee} is not an active user of this store`,
          code: "invalid_assignee",
        })
        return
      }
      assigneeName = (typeof user.name === "string" && user.name.trim()) || user.email
    }

    await mk.updateMarketingConversations({
      id,
      assigned_user_id: assignee,
      handler_mode: assignee ? "human" : "ai",
      ...(assignee ? {} : { handoff_reason: null }),
    } as any)

    await writeSystemMessage(
      mk,
      tenantId,
      id,
      assignee
        ? `${actorName(ctx)} assigned this conversation to ${assigneeName}.`
        : `${actorName(ctx)} unassigned this conversation and returned it to the AI assistant.`
    )

    res.json({ conversation: await serializeConversation(mk, id, tenantId) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to assign conversation",
    })
  }
}
