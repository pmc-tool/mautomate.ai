import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"

/**
 * GET /merchant/marketing/posts
 *
 * Merchant-scoped list of marketing posts. Query params: status, limit, offset.
 * Response: { posts, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: tenantId }
    if (req.query.status) {
      filters.status = req.query.status
    }

    const [posts, count] = await svc.listAndCountMarketingPosts(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ posts, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list posts",
    })
  }
}

/**
 * Normalize the `platforms` body field. Each entry may be a bare platform
 * string OR an object carrying per-platform copy overrides:
 *   "instagram"
 *   { platform: "instagram", override_body: "...", override_hashtags: ["..."] }
 */
const normalizePlatforms = (
  raw: any
): Array<{
  platform: string
  override_body: string | null
  override_hashtags: any
}> => {
  if (!Array.isArray(raw)) return []
  const out: Array<{
    platform: string
    override_body: string | null
    override_hashtags: any
  }> = []
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      out.push({
        platform: entry.trim(),
        override_body: null,
        override_hashtags: null,
      })
    } else if (entry && typeof entry === "object" && entry.platform) {
      out.push({
        platform: String(entry.platform),
        override_body:
          typeof entry.override_body === "string"
            ? entry.override_body
            : null,
        override_hashtags: Array.isArray(entry.override_hashtags)
          ? entry.override_hashtags
          : null,
      })
    }
  }
  return out
}

/**
 * POST /merchant/marketing/posts
 *
 * Create a merchant-scoped draft post, tagged with the caller's tenant.
 *
 * Optional extras:
 *  - `platforms`: string[] OR { platform, override_body?, override_hashtags? }[]
 *    → one tenant-tagged post_target per platform (with per-platform overrides).
 *  - `scheduled_at`: when a valid datetime is given AND targets exist, the
 *    targets are created "scheduled" at that time and the post flips to
 *    "scheduled".
 *  - `media`: ({ url?, file_id?, kind?, alt?, position? })[] → tenant-tagged
 *    post_media rows attached to the new post.
 *
 * Body: { title?, body?, hashtags?, link_url?, product_ids?, campaign_id?,
 *         brand_voice_id?, platforms?, scheduled_at?, media? }
 * Response: { post, targets }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const title = typeof b.title === "string" ? b.title.trim() : undefined
    const body = typeof b.body === "string" ? b.body.trim() : undefined

    if (!title && !body) {
      return res
        .status(400)
        .json({ message: "A post requires at least `title` or `body`." })
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    // Resolve an optional schedule up front.
    const when =
      typeof b.scheduled_at === "string" && b.scheduled_at.trim()
        ? new Date(b.scheduled_at)
        : null
    const scheduleValid = !!when && !isNaN(when.getTime())

    const platforms = normalizePlatforms(b.platforms)

    const created = await svc.createMarketingPosts({
      tenant_id: tenantId,
      status: scheduleValid && platforms.length ? "scheduled" : "draft",
      source: "manual",
      title: title ?? null,
      body: body ?? null,
      hashtags: Array.isArray(b.hashtags) ? b.hashtags : null,
      link_url: typeof b.link_url === "string" ? b.link_url.trim() : null,
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : null,
      campaign_id: typeof b.campaign_id === "string" ? b.campaign_id : null,
      brand_voice_id:
        typeof b.brand_voice_id === "string" ? b.brand_voice_id : null,
      created_by_user_id: (req as any).auth_context?.actor_id ?? null,
    } as any)

    const post = Array.isArray(created) ? created[0] : created
    const postId = (post as any).id

    let targets: any[] = []
    if (platforms.length) {
      const createdTargets = await svc.createMarketingPostTargets(
        platforms.map((p) => ({
          tenant_id: tenantId,
          post_id: postId,
          platform: p.platform,
          override_body: p.override_body,
          override_hashtags: p.override_hashtags,
          status: scheduleValid ? "scheduled" : "pending",
          scheduled_at: scheduleValid ? when : null,
        })) as any
      )
      targets = Array.isArray(createdTargets)
        ? createdTargets
        : [createdTargets]
    }

    // Optional media attachments.
    const mediaInput = Array.isArray(b.media) ? b.media : []
    if (mediaInput.length) {
      const rows = mediaInput
        .map((m: any, i: number) => {
          const url = typeof m?.url === "string" ? m.url.trim() : null
          const fileId = typeof m?.file_id === "string" ? m.file_id : null
          if (!url && !fileId) return null
          return {
            tenant_id: tenantId,
            post_id: postId,
            kind: m?.kind === "video" ? "video" : "image",
            file_id: fileId,
            url,
            alt: typeof m?.alt === "string" ? m.alt : null,
            position: Number.isFinite(Number(m?.position))
              ? Number(m.position)
              : i,
          }
        })
        .filter(Boolean)
      if (rows.length) {
        await (svc as any).createMarketingPostMedias(rows as any)
      }
    }

    const reloaded = await (svc as any).retrieveMarketingPost(postId, {
      relations: ["targets", "media", "revisions"],
    })

    res.status(201).json({ post: reloaded, targets })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to create post",
    })
  }
}
