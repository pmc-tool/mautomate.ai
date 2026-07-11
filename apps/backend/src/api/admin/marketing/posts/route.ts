import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { fromPostDto, toPostDto, toTargetDto } from "../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/posts
 *
 * Paginated list of marketing posts, tenant-scoped. Optional filters (query
 * string): status, campaign_id.
 * Response: { posts, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (req.query.status) {
      filters.status = req.query.status
    }
    if (req.query.campaign_id) {
      filters.campaign_id = req.query.campaign_id
    }

    const [posts, count] = await svc.listAndCountMarketingPosts(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    // Derive UI-only fields (platforms/scheduled_at) from each post's targets.
    // One filtered query for the whole page, grouped in memory — no N+1.
    const postIds = (posts as any[]).map((p) => p.id)
    const targetsByPost: Record<string, any[]> = {}
    if (postIds.length) {
      const targets = await svc.listMarketingPostTargets({
        tenant_id: TENANT_ID,
        post_id: postIds,
      })
      for (const t of targets as any[]) {
        ;(targetsByPost[(t as any).post_id] ??= []).push(t)
      }
    }

    res.json({
      posts: (posts as any[]).map((p) =>
        toPostDto(p, targetsByPost[p.id] ?? [])
      ),
      count,
      limit,
      offset,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list posts",
    })
  }
}

/**
 * POST /admin/marketing/posts
 *
 * Create a manual draft post. `body` or `title` should carry the copy; when
 * `platforms` are supplied a pending `post_target` is created per platform so
 * the post can later be scheduled/published. `product_ids` are stored for
 * downstream product-aware generation.
 * Body: { title?, body?, hashtags?, link_url?, product_ids?, platforms?,
 *         campaign_id?, brand_voice_id? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as Record<string, any>

  try {
    // Map the inbound UI vocabulary (content/link/hashtags-string) to columns.
    const mapped = fromPostDto(b)

    const title =
      typeof mapped.title === "string" ? mapped.title.trim() : undefined
    const body = typeof mapped.body === "string" ? mapped.body.trim() : undefined

    if (!title && !body) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A post requires at least `content` or a `title`."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingPosts({
      tenant_id: TENANT_ID,
      status: "draft",
      source: "manual",
      ...mapped,
      title: title ?? null,
      body: body ?? null,
      created_by_user_id: (req as any).auth_context?.actor_id ?? null,
    } as any)

    const post = Array.isArray(created) ? created[0] : created

    // Optional per-platform content overrides (UI `content` → `override_body`).
    const overridesByPlatform: Record<string, string | null> = {}
    if (Array.isArray(b.targets)) {
      for (const t of b.targets) {
        if (t && t.platform) {
          overridesByPlatform[t.platform] = t.content ?? null
        }
      }
    }

    const platforms = Array.isArray(b.platforms) ? b.platforms : []
    let targets: any[] = []
    if (platforms.length) {
      const createdTargets = await svc.createMarketingPostTargets(
        platforms.map((platform) => ({
          tenant_id: TENANT_ID,
          post_id: (post as any).id,
          platform,
          status: "pending",
          override_body: overridesByPlatform[platform] ?? null,
        })) as any
      )
      targets = Array.isArray(createdTargets)
        ? createdTargets
        : [createdTargets]
    }

    res.status(201).json({
      post: toPostDto(post, targets),
      targets: targets.map(toTargetDto),
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create post",
    })
  }
}
