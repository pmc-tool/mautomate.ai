import { resolveTenantId } from "../../../../../lib/tenant-context"
/**
 * /admin/marketing/conversations/:id
 *
 * GET  — the thread detail view: the conversation, its full message list
 *        (chronological), and a Customer360 commerce snapshot for the contact.
 *        Opening a thread marks it read (unread_count → 0).
 * POST — partial update of { status?, starred?, assigned_user_id? }.
 *
 * Tenant-scoped: a conversation belonging to another tenant 404s.
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { buildCustomer360 } from "../../../../../modules/marketing/messaging/ai-reply"
import { toConversationDto, toMessageDto } from "../_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Load a conversation and assert tenant ownership; null when missing/foreign. */
const loadConversation = async (
  mk: any,
  id: string
): Promise<any | null> => {
  try {
    const row = await mk.retrieveMarketingConversation(id)
    if (!row || row.tenant_id !== TENANT_ID) {
      return null
    }
    return row
  } catch {
    return null
  }
}

/** Resolve the contact behind a conversation (or null). */
const loadContact = async (mk: any, conversation: any): Promise<any | null> => {
  if (!conversation.contact_id) {
    return null
  }
  try {
    return await mk.retrieveMarketingContact(conversation.contact_id)
  } catch {
    return null
  }
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const { id } = req.params

    const conversation = await loadConversation(mk, id)
    if (!conversation) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    // Full thread, chronological.
    const rows = await mk.listMarketingMessages(
      { conversation_id: id },
      { order: { sent_at: "ASC" }, take: 1000 }
    )
    const messageRows = Array.isArray(rows) ? rows : []
    const messages = messageRows.map(toMessageDto)

    const contact = await loadContact(mk, conversation)
    const customer360 = await buildCustomer360(req.scope, contact)

    // Mark read on open.
    if ((conversation.unread_count ?? 0) !== 0) {
      try {
        await mk.updateMarketingConversations({ id, unread_count: 0 } as any)
        conversation.unread_count = 0
      } catch {
        // Non-fatal: failing to clear unread must not break the read view.
      }
    }

    const lastBody =
      messageRows.length > 0
        ? messageRows[messageRows.length - 1]?.body ?? null
        : null

    res.json({
      conversation: toConversationDto(conversation, contact, lastBody),
      messages,
      customer360,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load conversation",
    })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const { id } = req.params

    const conversation = await loadConversation(mk, id)
    if (!conversation) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    const body = (req.body ?? {}) as {
      status?: string
      starred?: boolean
      assigned_user_id?: string | null
    }

    const patch: Record<string, any> = { id }
    if (typeof body.status === "string") {
      patch.status = body.status
    }
    if (typeof body.starred === "boolean") {
      patch.starred = body.starred
    }
    if (body.assigned_user_id !== undefined) {
      patch.assigned_user_id = body.assigned_user_id
    }

    await mk.updateMarketingConversations(patch as any)

    const updated = (await loadConversation(mk, id)) ?? conversation
    const contact = await loadContact(mk, updated)

    let preview: string | null = null
    try {
      const last = await mk.listMarketingMessages(
        { conversation_id: id },
        { order: { sent_at: "DESC" }, take: 1 }
      )
      const msg = Array.isArray(last) ? last[0] : last
      preview = msg?.body ?? null
    } catch {
      preview = null
    }

    res.json({
      conversation: toConversationDto(updated, contact, preview),
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update conversation",
    })
  }
}
