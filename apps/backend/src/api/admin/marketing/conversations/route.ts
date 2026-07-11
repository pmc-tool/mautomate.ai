import { resolveTenantId } from "../../../../lib/tenant-context"
/**
 * GET /admin/marketing/conversations
 *
 * The inbox list view. Lists a tenant's conversations newest-first, with
 * optional `status`, `channel`, and free-text `q` filters. Each row is enriched
 * with its contact and a `preview` (the last message body).
 *
 * `q` matches the contact's display_name / phone / email, which the conversation
 * store cannot express directly, so when `q` is present we list broadly and
 * filter in memory (then paginate the filtered set). Without `q` we paginate at
 * the store with listAndCount.
 *
 * Response: { conversations: ConversationDto[], count: number }
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { toConversationDto, type ConversationDto } from "./_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const asString = (v: any): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined

/**
 * Enrich a batch of conversation rows into ConversationDtos: one batched contact
 * lookup for the whole page, plus a last-message preview per conversation.
 */
const serializeConversations = async (
  mk: any,
  rows: any[]
): Promise<ConversationDto[]> => {
  // Batch-resolve contacts.
  const contactIds = Array.from(
    new Set(rows.map((r) => r.contact_id).filter(Boolean))
  ) as string[]
  const contactMap = new Map<string, any>()
  if (contactIds.length) {
    const contacts = await mk.listMarketingContacts({
      tenant_id: TENANT_ID,
      id: contactIds,
    })
    for (const c of Array.isArray(contacts) ? contacts : []) {
      contactMap.set(c.id, c)
    }
  }

  // Preview = last message body per conversation.
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

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const status = asString(req.query.status)
    const channel = asString(req.query.channel)
    const q = asString(req.query.q)
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 20) || 20, 100))
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0)

    const filter: Record<string, any> = { tenant_id: TENANT_ID }
    if (status) {
      filter.status = status
    }
    if (channel) {
      filter.channel = channel
    }

    let pageRows: any[]
    let count: number

    if (q) {
      // Broad list, resolve contacts, filter in memory, then paginate.
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
          tenant_id: TENANT_ID,
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
        if (!c) {
          return false
        }
        return matches(c.display_name) || matches(c.phone) || matches(c.email)
      })

      count = filtered.length
      pageRows = filtered.slice(offset, offset + limit)
    } else {
      const [rows, total] = await mk.listAndCountMarketingConversations(
        filter,
        {
          order: { last_message_at: "DESC" },
          skip: offset,
          take: limit,
        }
      )
      pageRows = Array.isArray(rows) ? rows : []
      count = total ?? pageRows.length
    }

    const conversations = await serializeConversations(mk, pageRows)

    res.json({ conversations, count })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list conversations",
    })
  }
}
