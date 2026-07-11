import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { toPostDetailDto } from "../../../_serialize"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/posts/:id/schedule
 *
 * Schedule a post for delivery. Sets `scheduled_at` + status "scheduled" on its
 * targets and flips the post to "scheduled". The Phase-2 publish runner then
 * claims due targets by (tenant_id, status, scheduled_at). When `targets` (an
 * array of target ids) is supplied only those are scheduled; otherwise every
 * target on the post is scheduled.
 * Body: { scheduled_at, targets?: string[] }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    scheduled_at?: string | null
    targets?: string[]
  }

  try {
    // `scheduled_at: null` (explicitly) is an UNSCHEDULE request; a string is a
    // schedule request; anything else (missing/invalid non-null) is an error.
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

    const post = await svc.retrieveMarketingPost(id, {
      relations: ["targets"],
    })
    if ((post as any).tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const allTargets = ((post as any).targets ?? []) as any[]
    const requested = Array.isArray(b.targets) ? b.targets : null
    const toSchedule = requested
      ? allTargets.filter((t) => requested.includes(t.id))
      : allTargets

    if (!toSchedule.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The post has no targets to schedule. Add platform targets first."
      )
    }

    await svc.updateMarketingPostTargets(
      toSchedule.map((t) => ({
        id: t.id,
        scheduled_at: isUnschedule ? null : when,
        status: isUnschedule ? "pending" : "scheduled",
      })) as any
    )

    // Only flip the whole post's status when we scheduled everything. On an
    // unschedule, revert to draft; on a partial schedule, leave the post as-is.
    if (isUnschedule) {
      await svc.updateMarketingPosts({ id, status: "draft" } as any)
    } else if (!requested) {
      await svc.updateMarketingPosts({ id, status: "scheduled" } as any)
    }

    // The UI consumes this response as a PostDetail — reload relations so the
    // freshly scheduled targets surface with their new scheduled_at.
    const reloaded = await svc.retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({
      ...toPostDetailDto(reloaded, {
        targets: (reloaded as any).targets ?? [],
        media: (reloaded as any).media ?? [],
        revisions: (reloaded as any).revisions ?? [],
      }),
      scheduled_target_ids: toSchedule.map((t) => t.id),
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to schedule post",
    })
  }
}
