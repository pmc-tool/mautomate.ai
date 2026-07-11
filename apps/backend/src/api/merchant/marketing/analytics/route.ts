import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { withTenant } from "../../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { getDashboard } from "../../../../modules/marketing/analytics/stats-service"
import { resolveMerchant } from "../../_helpers"

/**
 * GET /merchant/marketing/analytics
 *
 * Real, tenant-scoped marketing analytics for the merchant dashboard. Returns a
 * focused summary (post counts by status, posts scheduled in the next 7 days,
 * connected accounts, recent conversations) computed directly from this
 * tenant's rows, plus the full honest performance dashboard from the stats
 * service. Every figure is derived from stored data — empty tenants report
 * zeros, never fabricated numbers.
 *
 * The stats service reads the tenant from the async tenant context, so the
 * dashboard call is wrapped in withTenant(ctx.tenant.id) to guarantee scoping
 * even if the request-level context were ever absent.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const [posts, postsTotal] = await svc.listAndCountMarketingPosts(
      { tenant_id: tenantId },
      { take: 5000, order: { created_at: "DESC" } }
    )

    const postsByStatus = (posts ?? []).reduce(
      (acc: Record<string, number>, post: any) => {
        const status = post?.status ?? "unknown"
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [, scheduledNext7d] = await svc.listAndCountMarketingPostTargets(
      {
        tenant_id: tenantId,
        status: "scheduled",
        scheduled_at: { $gte: now, $lte: in7Days },
      },
      { take: 1 }
    )

    const connectedAccounts = await svc.listMarketingSocialAccounts(
      { tenant_id: tenantId, status: "connected" },
      { take: 1000 }
    )

    const [, recentConversations] =
      await svc.listAndCountMarketingConversations(
        { tenant_id: tenantId, last_message_at: { $gte: last7Days } },
        { take: 1 }
      )

    // Full honest dashboard (tenant-scoped via the async context).
    const dashboard = await withTenant(tenantId, () =>
      getDashboard(req.scope, {})
    ).catch(() => null)

    res.json({
      tenant_id: tenantId,
      summary: {
        posts_total: postsTotal,
        posts_by_status: postsByStatus,
        scheduled_next_7d: scheduledNext7d,
        connected_accounts: Array.isArray(connectedAccounts)
          ? connectedAccounts.length
          : 0,
        recent_conversations: recentConversations,
      },
      dashboard,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load marketing analytics",
    })
  }
}
