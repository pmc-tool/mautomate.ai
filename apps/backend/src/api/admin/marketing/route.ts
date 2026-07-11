import { resolveTenantId } from "../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import MarketingModuleService from "../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing
 *
 * Dashboard summary for the marketing console: post counts grouped by status,
 * posts/targets scheduled to go out in the next 7 days, brand-voice count, and
 * connected social-account count. Every query is scoped to the default tenant.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const [posts, postsTotal] = await svc.listAndCountMarketingPosts(
      { tenant_id: TENANT_ID },
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

    const [, scheduledNext7d] = await svc.listAndCountMarketingPostTargets(
      {
        tenant_id: TENANT_ID,
        status: "scheduled",
        scheduled_at: { $gte: now, $lte: in7Days },
      },
      { take: 1 }
    )

    const [, brandVoiceCount] = await svc.listAndCountMarketingBrandVoices(
      { tenant_id: TENANT_ID },
      { take: 1 }
    )

    const connectedAccounts = await svc.listMarketingSocialAccounts(
      { tenant_id: TENANT_ID, status: "connected" },
      { take: 1000 }
    )

    res.json({
      tenant_id: TENANT_ID,
      posts: {
        total: postsTotal,
        by_status: postsByStatus,
      },
      scheduled_next_7d: scheduledNext7d,
      brand_voice_count: brandVoiceCount,
      connected_accounts_count: Array.isArray(connectedAccounts)
        ? connectedAccounts.length
        : 0,
    })
  } catch (e: any) {
    res.status(e?.type === "not_found" ? 404 : 500).json({
      message: e?.message ?? "Failed to load marketing summary",
    })
  }
}
