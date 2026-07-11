import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Allowed status transitions per approval action. `approve` resolves to
 * "scheduled" when a schedule exists (post body or any target), else stays in
 * the "needs_approval" review lane.
 */
const ACTIONS = {
  submit: { from: ["draft"], to: "needs_approval" },
  approve: { from: ["draft", "needs_approval"], to: "scheduled" },
  reject: { from: ["needs_approval"], to: "draft" },
} as const

type ActionKey = keyof typeof ACTIONS

/**
 * POST /merchant/marketing/posts/:id/approve
 *
 * Drive a post through its approval lifecycle, writing a revision snapshot on
 * every transition. Tenant-scoped.
 * Body: { action: "submit" | "approve" | "reject", scheduled_at? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as { action?: string; scheduled_at?: string }

  try {
    const action = b.action?.trim() as ActionKey | undefined
    if (!action || !ACTIONS[action]) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid \`action\`. Expected one of: ${Object.keys(ACTIONS).join(", ")}.`
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await (svc as any)
      .retrieveMarketingPost(id, { relations: ["targets"] })
      .catch(() => null)
    if (!current || current.tenant_id !== tenantId) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const from = current.status as string
    const rule = ACTIONS[action]
    if (!(rule.from as readonly string[]).includes(from)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Cannot "${action}" a post in status "${from}". Allowed from: ${rule.from.join(
          ", "
        )}.`
      )
    }

    let to: string = rule.to
    if (action === "approve") {
      const targets = (current.targets ?? []) as any[]
      const hasSchedule =
        !!b.scheduled_at || targets.some((t) => !!t?.scheduled_at)
      to = hasSchedule ? "scheduled" : "needs_approval"
    }

    const [, revCount] = await svc.listAndCountMarketingPostRevisions(
      { tenant_id: tenantId, post_id: id },
      { take: 1 }
    )
    await svc.createMarketingPostRevisions({
      tenant_id: tenantId,
      post_id: id,
      version: (revCount ?? 0) + 1,
      snapshot: {
        action,
        from,
        to,
        title: current.title ?? null,
        body: current.body ?? null,
        hashtags: current.hashtags ?? null,
        link_url: current.link_url ?? null,
      },
      created_by_user_id: (req as any).auth_context?.actor_id ?? null,
    } as any)

    await svc.updateMarketingPosts({ id, status: to } as any)

    const reloaded = await (svc as any).retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({ post: reloaded })
  } catch (e: any) {
    let status = 500
    if (e?.type === MedusaError.Types.INVALID_DATA) {
      status = 400
    } else if (e?.type === MedusaError.Types.NOT_ALLOWED) {
      status = 409
    }
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update post approval status",
    })
  }
}
