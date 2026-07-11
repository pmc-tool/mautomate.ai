import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/marketing/posts/:id/schedule
 *
 * Schedule a post for delivery. Sets `scheduled_at` + status "scheduled" on its
 * targets and flips the post to "scheduled". Passing `scheduled_at: null`
 * unschedules (targets → pending, post → draft).
 *
 * `target_platforms` (array of platform strings) restricts scheduling to the
 * matching targets; otherwise every target on the post is scheduled.
 *
 * Body: { scheduled_at, target_platforms?: string[] }
 * Tenant-scoped: a post belonging to another tenant 404s.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as {
    scheduled_at?: string | null
    target_platforms?: string[]
  }

  try {
    const isUnschedule =
      "scheduled_at" in b && (b.scheduled_at === null || b.scheduled_at === "")
    const when = b.scheduled_at ? new Date(b.scheduled_at) : null
    if (!isUnschedule && (!when || isNaN(when.getTime()))) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A valid `scheduled_at` datetime is required to schedule a post."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const post = await (svc as any)
      .retrieveMarketingPost(id, { relations: ["targets"] })
      .catch(() => null)
    if (!post || post.tenant_id !== tenantId) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const allTargets = (post.targets ?? []) as any[]
    const platforms = Array.isArray(b.target_platforms)
      ? b.target_platforms
      : null
    const toSchedule = platforms
      ? allTargets.filter((t) => platforms.includes(t.platform))
      : allTargets

    if (!toSchedule.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The post has no matching targets to schedule. Add platform targets first."
      )
    }

    await svc.updateMarketingPostTargets(
      toSchedule.map((t) => ({
        id: t.id,
        scheduled_at: isUnschedule ? null : when,
        status: isUnschedule ? "pending" : "scheduled",
      })) as any
    )

    if (isUnschedule) {
      await svc.updateMarketingPosts({ id, status: "draft" } as any)
    } else if (!platforms) {
      await svc.updateMarketingPosts({ id, status: "scheduled" } as any)
    }

    const reloaded = await (svc as any).retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({
      post: reloaded,
      scheduled_target_ids: toSchedule.map((t) => t.id),
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to schedule post",
    })
  }
}
