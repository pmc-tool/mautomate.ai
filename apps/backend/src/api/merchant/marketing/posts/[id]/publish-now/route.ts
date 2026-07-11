import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { withTenant } from "../../../../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { runPublishSweep } from "../../../../../../modules/marketing/publish/runner"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/marketing/posts/:id/publish-now
 *
 * Mark the post's targets due now, then run the tenant's publish sweep so the
 * publish engine claims and delivers them. Tenant-scoped.
 *
 * HONEST GATING: live publishing is gated on MARKETING_ENABLED=1 (and the
 * per-tenant kill switch). When publishing is disabled the targets are left
 * scheduled-due and the response says so — nothing is faked as published. When
 * enabled but a platform lacks connected credentials, the sweep records that
 * target as failed with a clear error (again, never faked).
 *
 * Body: { target_platforms?: string[] }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as { target_platforms?: string[] }

  try {
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
    const toPublish = platforms
      ? allTargets.filter((t) => platforms.includes(t.platform))
      : allTargets

    if (!toPublish.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The post has no matching targets to publish. Add platform targets first."
      )
    }

    const now = new Date()
    // Make the targets due now so the claim-first sweep will pick them up.
    await svc.updateMarketingPostTargets(
      toPublish.map((t) => ({
        id: t.id,
        status: "scheduled",
        scheduled_at: now,
      })) as any
    )

    const publishingEnabled = process.env.MARKETING_ENABLED === "1"

    if (!publishingEnabled) {
      await svc.updateMarketingPosts({ id, status: "scheduled" } as any)
      const reloaded = await (svc as any).retrieveMarketingPost(id, {
        relations: ["targets", "media", "revisions"],
      })
      res.status(202).json({
        published: false,
        publishing_disabled: true,
        note: "Live publishing is disabled (MARKETING_ENABLED is not set). The targets are scheduled and due; they will publish once publishing is enabled and platform credentials are connected.",
        post: reloaded,
      })
      return
    }

    // Publishing enabled: run the sweep in this tenant's context so the runner's
    // tenant-scoped reads/claims resolve to ctx.tenant.id.
    const result = await withTenant(tenantId, () =>
      runPublishSweep(req.scope, { now })
    )

    const reloaded = await (svc as any).retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({
      published: (result?.published ?? 0) > 0,
      sweep: result,
      post: reloaded,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to publish post",
    })
  }
}
