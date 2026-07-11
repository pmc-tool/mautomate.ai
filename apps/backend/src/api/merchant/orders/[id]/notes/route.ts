import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const NoteSchema = z.object({
  note: z.string().min(1).max(2000),
})

// Load the order (scoped to the tenant's sales channel) and return its metadata.
// Returns null if the order does not belong to this tenant.
async function loadTenantOrder(req: MedusaRequest, id: string, scId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: ["id", "metadata"],
    pagination: { take: 1, skip: 0 } as any,
  })
  return (data || [])[0] || null
}

/**
 * Merge the two note sources on an order into one chronological list:
 *  - `metadata.notes`    — internal notes a merchant typed on this page.
 *  - `metadata.cc_notes` — notes the AI voice agent captured on a call (shape
 *    { at, text, source, call_id }). These were previously invisible here.
 * Both are normalized to { id, note, author_email, created_at, source } so the
 * dashboard renders them the same way.
 */
function mergeNotes(metadata: any): any[] {
  const merchantNotes = Array.isArray(metadata?.notes) ? metadata.notes : []
  const aiNotes = (Array.isArray(metadata?.cc_notes) ? metadata.cc_notes : []).map(
    (n: any, i: number) => ({
      id: `cc_${n.call_id || "call"}_${n.at || i}`,
      note: n.text ?? "",
      author_id: null,
      author_email: "AI voice agent",
      created_at: n.at ?? null,
      source: "ai_call",
      call_id: n.call_id ?? null,
    })
  )
  return [...merchantNotes, ...aiNotes].sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  )
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const order = await loadTenantOrder(req, id, scId)
  if (!order) return res.status(404).json({ message: "order not found" })

  res.json({ notes: mergeNotes(order.metadata) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = NoteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  // Tenant ownership guard: order must belong to this tenant's sales channel.
  const order = await loadTenantOrder(req, id, scId)
  if (!order) return res.status(404).json({ message: "order not found" })

  const existing = Array.isArray(order.metadata?.notes) ? order.metadata.notes : []
  const note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    note: parsed.data.note,
    author_id: ctx.merchant.id,
    author_email: ctx.merchant.email,
    created_at: new Date().toISOString(),
  }
  const notes = [...existing, note]

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const nextMetadata = { ...(order.metadata || {}), notes }
  await orderModule.updateOrders(id, { metadata: nextMetadata })

  // Return the full merged list (merchant + AI notes) so the AI notes don't
  // vanish from the view right after adding an internal note.
  res.status(201).json({ note, notes: mergeNotes(nextMetadata) })
}
