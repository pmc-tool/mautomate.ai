import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { resolveMerchant } from "../../_helpers"
import { toConversationDto, type ConversationDto } from "./_dto"

const asString = (v: any): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined

const asBool = (v: any): boolean => v === "true" || v === true

/**
 * The last message of every conversation on the page, in ONE query.
 *
 * This used to be a per-conversation lookup inside the serialize loop. The inbox
 * polls every 8 seconds, so a 50-row page meant 50 round trips every 8 seconds,
 * per open inbox, forever. DISTINCT ON collapses that to a single index scan.
 */
const loadPreviews = async (
  pg: any,
  conversationIds: string[]
): Promise<Map<string, string | null>> => {
  const previews = new Map<string, string | null>()
  if (!conversationIds.length) return previews

  const result = await pg
    .select("conversation_id", "body")
    .from("marketing_message")
    .distinctOn("conversation_id")
    .whereIn("conversation_id", conversationIds)
    .whereNull("deleted_at")
    .orderBy([
      { column: "conversation_id" },
      { column: "sent_at", order: "desc" },
    ])

  for (const row of Array.isArray(result) ? result : []) {
    previews.set(String(row.conversation_id), row.body ?? null)
  }
  return previews
}

/**
 * Enrich conversation rows into ConversationDtos: one batched contact lookup and
 * one batched preview lookup for the whole page. Tenant-scoped.
 */
const serializeConversations = async (
  mk: any,
  pg: any,
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

  let previews = new Map<string, string | null>()
  try {
    previews = await loadPreviews(
      pg,
      rows.map((r) => r.id)
    )
  } catch {
    // A preview is a nicety. Losing it must not cost the merchant the inbox.
  }

  return rows.map((row) =>
    toConversationDto(
      row,
      row.contact_id ? (contactMap.get(row.contact_id) ?? null) : null,
      previews.get(row.id) ?? null
    )
  )
}

/**
 * GET /merchant/marketing/conversations
 *
 * The inbox list for THIS tenant, newest-first.
 *
 * Filters (all optional, all applied in the database so they keep working past
 * the first page — a "view" that only filters the rows already fetched is a view
 * that silently hides conversations):
 *   status         exact status
 *   exclude_closed drop closed threads (the working views: needs you, mine, ...)
 *   channel        exact channel
 *   handler_mode   ai | queued | human
 *   assigned       me | none
 *   starred        true
 *   unread         true
 *   q              free-text over the contact's name / phone / email
 *
 * Response: { conversations, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const userId = ctx.merchant.id
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  try {
    const status = asString(req.query.status)
    const channel = asString(req.query.channel)
    const handlerMode = asString(req.query.handler_mode)
    const assigned = asString(req.query.assigned)
    const q = asString(req.query.q)
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 20) || 20, 100))
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0)

    const filter: Record<string, any> = { tenant_id: tenantId }
    if (status) filter.status = status
    else if (asBool(req.query.exclude_closed)) filter.status = { $ne: "closed" }
    if (channel) filter.channel = channel
    if (handlerMode) filter.handler_mode = handlerMode
    if (assigned === "me") filter.assigned_user_id = userId
    if (assigned === "none") filter.assigned_user_id = null
    if (asBool(req.query.starred)) filter.starred = true
    if (asBool(req.query.unread)) filter.unread_count = { $gt: 0 }

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

    const conversations = await serializeConversations(mk, pg, tenantId, pageRows)
    res.json({ conversations, count })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list conversations",
    })
  }
}
