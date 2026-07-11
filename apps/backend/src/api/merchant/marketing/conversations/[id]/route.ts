import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { buildCustomer360 } from "../../../../../modules/marketing/messaging/ai-reply"
import { resolveMerchant } from "../../../_helpers"
import { toConversationDto, toMessageDto } from "../_dto"

/** Load a conversation and assert tenant ownership; null when missing/foreign. */
const loadConversation = async (
  mk: any,
  id: string,
  tenantId: string
): Promise<any | null> => {
  try {
    const row = await mk.retrieveMarketingConversation(id)
    if (!row || row.tenant_id !== tenantId) return null
    return row
  } catch {
    return null
  }
}

const loadContact = async (mk: any, conversation: any): Promise<any | null> => {
  if (!conversation.contact_id) return null
  try {
    return await mk.retrieveMarketingContact(conversation.contact_id)
  } catch {
    return null
  }
}

/**
 * GET /merchant/marketing/conversations/:id
 *
 * The thread detail: the conversation, its full chronological message list, and
 * a Customer360 commerce snapshot for the contact. Opening marks it read.
 * Tenant-scoped: a foreign conversation 404s.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const conversation = await loadConversation(mk, id, tenantId)
    if (!conversation) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    const rows = await mk.listMarketingMessages(
      { conversation_id: id },
      { order: { sent_at: "ASC" }, take: 1000 }
    )
    const messageRows = Array.isArray(rows) ? rows : []
    const messages = messageRows.map(toMessageDto)

    const contact = await loadContact(mk, conversation)
    const customer360 = await buildCustomer360(req.scope, contact)

    if ((conversation.unread_count ?? 0) !== 0) {
      try {
        await mk.updateMarketingConversations({ id, unread_count: 0 } as any)
        conversation.unread_count = 0
      } catch {
        // Non-fatal.
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

/**
 * POST /merchant/marketing/conversations/:id
 *
 * Partial update of { status?, starred?, assigned_user_id? }. Tenant-scoped.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const conversation = await loadConversation(mk, id, tenantId)
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
    if (typeof body.status === "string") patch.status = body.status
    if (typeof body.starred === "boolean") patch.starred = body.starred
    if (body.assigned_user_id !== undefined) {
      patch.assigned_user_id = body.assigned_user_id
    }

    await mk.updateMarketingConversations(patch as any)

    const updated = (await loadConversation(mk, id, tenantId)) ?? conversation
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
