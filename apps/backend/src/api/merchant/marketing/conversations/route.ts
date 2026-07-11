import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { resolveMerchant } from "../../_helpers"
import { toConversationDto, type ConversationDto } from "./_dto"

const asString = (v: any): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined

/**
 * Enrich conversation rows into ConversationDtos: one batched contact lookup for
 * the page plus a last-message preview per conversation. Tenant-scoped.
 */
const serializeConversations = async (
  mk: any,
  tenantId: string,
  rows: any[]
): Promise<ConversationDto[]> => {
  const contactIds = Array.from(
    new Set(rows.map((r) => r.contact_id).filter(Boolean))
  ) as string[]
  const contactMap = new Map<string, any>()
  if (contactIds.length) {
    const contacts = await mk.listMarketingContacts({
      tenant_id: tenantId,
      id: contactIds,
    })
    for (const c of Array.isArray(contacts) ? contacts : []) {
      contactMap.set(c.id, c)
    }
  }

  const dtos: ConversationDto[] = []
  for (const row of rows) {
    let preview: string | null = null
    try {
      const last = await mk.listMarketingMessages(
        { conversation_id: row.id },
        { order: { sent_at: "DESC" }, take: 1 }
      )
      const msg = Array.isArray(last) ? last[0] : last
      preview = msg?.body ?? null
    } catch {
      preview = null
    }
    const contact = row.contact_id ? contactMap.get(row.contact_id) : null
    dtos.push(toConversationDto(row, contact ?? null, preview))
  }
  return dtos
}

/**
 * GET /merchant/marketing/conversations
 *
 * The inbox list for THIS tenant, newest-first, with optional `status`,
 * `channel`, and free-text `q` (matches contact name/phone/email) filters.
 * Response: { conversations, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  try {
    const status = asString(req.query.status)
    const channel = asString(req.query.channel)
    const q = asString(req.query.q)
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 20) || 20, 100))
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0)

    const filter: Record<string, any> = { tenant_id: tenantId }
    if (status) filter.status = status
    if (channel) filter.channel = channel

    let pageRows: any[]
    let count: number

    if (q) {
      const rows = await mk.listMarketingConversations(filter, {
        order: { last_message_at: "DESC" },
        take: 500,
      })
      const all = Array.isArray(rows) ? rows : []

      const contactIds = Array.from(
        new Set(all.map((r) => r.contact_id).filter(Boolean))
      ) as string[]
      const contactMap = new Map<string, any>()
      if (contactIds.length) {
        const contacts = await mk.listMarketingContacts({
          tenant_id: tenantId,
          id: contactIds,
        })
        for (const c of Array.isArray(contacts) ? contacts : []) {
          contactMap.set(c.id, c)
        }
      }

      const ql = q.toLowerCase()
      const matches = (v: any): boolean =>
        typeof v === "string" && v.toLowerCase().includes(ql)
      const filtered = all.filter((r) => {
        const c = r.contact_id ? contactMap.get(r.contact_id) : null
        if (!c) return false
        return matches(c.display_name) || matches(c.phone) || matches(c.email)
      })

      count = filtered.length
      pageRows = filtered.slice(offset, offset + limit)
    } else {
      const [rows, total] = await mk.listAndCountMarketingConversations(filter, {
        order: { last_message_at: "DESC" },
        skip: offset,
        take: limit,
      })
      pageRows = Array.isArray(rows) ? rows : []
      count = total ?? pageRows.length
    }

    const conversations = await serializeConversations(mk, tenantId, pageRows)
    res.json({ conversations, count })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list conversations",
    })
  }
}
