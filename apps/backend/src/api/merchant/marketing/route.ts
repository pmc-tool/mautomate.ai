import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import MarketingModuleService from "../../../modules/marketing/service"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/marketing
 *
 * Merchant-scoped marketing dashboard summary. Posts by status, scheduled
 * posts in the next 7 days, brand voice count, connected social accounts,
 * and recent conversations (last 7 days).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const [posts, postsTotal] = await svc.listAndCountMarketingPosts(
      { tenant_id: tenantId },
      { take: 1000, order: { created_at: "DESC" } }
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

    const [, brandVoiceCount] = await svc.listAndCountMarketingBrandVoices(
      { tenant_id: tenantId },
      { take: 1 }
    )

    const connectedAccounts = await svc.listMarketingSocialAccounts(
      { tenant_id: tenantId, status: "connected" },
      { take: 1000 }
    )

    const [, recentConversationsCount] = await svc.listAndCountMarketingConversations(
      {
        tenant_id: tenantId,
        last_message_at: { $gte: last7Days },
      },
      { take: 1 }
    )

    res.json({
      tenant_id: tenantId,
      posts: {
        total: postsTotal,
        by_status: postsByStatus,
      },
      scheduled_next_7d: scheduledNext7d,
      brand_voice_count: brandVoiceCount,
      connected_accounts_count: Array.isArray(connectedAccounts)
        ? connectedAccounts.length
        : 0,
      recent_conversations_count: recentConversationsCount,
    })
  } catch (e: any) {
    res.status(e?.type === "not_found" ? 404 : 500).json({
      message: e?.message ?? "Failed to load marketing summary",
    })
  }
}
