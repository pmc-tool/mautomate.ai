import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import { toInboxNoteDto } from "../../_dto"
import { first, loadConversation, marketing } from "../../_ops"

const MAX_NOTE_LENGTH = 5000

/**
 * GET /merchant/marketing/conversations/:id/notes
 *
 * The thread's internal notes, newest first. Notes are never delivered to the
 * contact — they live outside marketing_message on purpose.
 * Response: { notes, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
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

    const rows = await mk.listMarketingInboxNotes(
      { tenant_id: tenantId, conversation_id: id },
      { order: { created_at: "DESC" }, take: 200 }
    )
    const notes = (Array.isArray(rows) ? rows : []).map(toInboxNoteDto)

    res.json({ notes, count: notes.length })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list notes" })
  }
}

/**
 * POST /merchant/marketing/conversations/:id/notes
 *
 * Add an internal note authored by the current merchant user.
 * Body: { content: string }
 * Response: { note }
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

    const body = (req.body ?? {}) as { content?: unknown }
    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (!content) {
      res.status(400).json({ message: "content is required" })
      return
    }
    if (content.length > MAX_NOTE_LENGTH) {
      res.status(400).json({
        message: `content must be at most ${MAX_NOTE_LENGTH} characters`,
      })
      return
    }

    const created = await mk.createMarketingInboxNotes({
      tenant_id: tenantId,
      conversation_id: id,
      author_id: ctx.merchant.id,
      content,
    } as any)

    res.status(201).json({ note: toInboxNoteDto(first<any>(created)) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to create note" })
  }
}
