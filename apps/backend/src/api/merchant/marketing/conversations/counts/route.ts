import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../../_helpers"

export type InboxCounts = {
  views: {
    needs_you: number
    unassigned: number
    mine: number
    starred: number
    open: number
    closed: number
    all: number
    unread: number
  }
  channels: Record<string, number>
}

/**
 * GET /merchant/marketing/conversations/counts
 *
 * The badge numbers behind the inbox rail. These MUST be exact: a badge that
 * counts only the conversations that happen to be on the loaded page is a badge
 * that lies, and a merchant who trusts "Needs you: 0" while a customer waits is
 * a merchant who loses the sale.
 *
 * So they are counted in the database over the tenant's whole inbox, never over
 * a page of it: two grouped scans, both served by the existing partial indexes
 * on (tenant_id, ...) WHERE deleted_at IS NULL.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const userId = ctx.merchant.id
  const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const rowsOf = (result: any): any[] =>
    Array.isArray(result) ? result : (result?.rows ?? [])

  try {
    const viewsResult = await pg.raw(
      `select
         count(*) filter (where handler_mode = 'queued' and status <> 'closed')   as needs_you,
         count(*) filter (where assigned_user_id is null and status <> 'closed')  as unassigned,
         count(*) filter (where assigned_user_id = ? and status <> 'closed')      as mine,
         count(*) filter (where starred)                                          as starred,
         count(*) filter (where status = 'open')                                  as open_count,
         count(*) filter (where status = 'closed')                                as closed_count,
         count(*) filter (where unread_count > 0)                                 as unread,
         count(*)                                                                 as total
       from marketing_conversation
      where tenant_id = ? and deleted_at is null`,
      [userId, tenantId]
    )
    const views = rowsOf(viewsResult)[0] ?? {}

    const channelResult = await pg.raw(
      `select channel, count(*) as n
         from marketing_conversation
        where tenant_id = ? and deleted_at is null
        group by channel`,
      [tenantId]
    )

    const channels: Record<string, number> = {}
    for (const row of rowsOf(channelResult)) {
      channels[String(row.channel)] = Number(row.n) || 0
    }

    const n = (v: any): number => Number(v) || 0
    const payload: InboxCounts = {
      views: {
        needs_you: n(views.needs_you),
        unassigned: n(views.unassigned),
        mine: n(views.mine),
        starred: n(views.starred),
        open: n(views.open_count),
        closed: n(views.closed_count),
        all: n(views.total),
        unread: n(views.unread),
      },
      channels,
    }

    res.json(payload)
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Failed to count conversations" })
  }
}
