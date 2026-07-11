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
 * Which current statuses each approval action may run from. The `approve`
 * action resolves to "scheduled" when the post has a scheduled_at (on the post
 * body or any target), otherwise it stays in the "needs_approval" review lane
 * (the enum has no dedicated "needs_review" state — see assumptions).
 */
const ACTIONS = {
  submit: { from: ["draft"], to: "needs_approval" },
  approve: { from: ["draft", "needs_approval"], to: "scheduled" },
  reject: { from: ["needs_approval"], to: "draft" },
} as const

type ActionKey = keyof typeof ACTIONS

/**
 * POST /admin/marketing/posts/:id/approve
 *
 * Drive a post through its approval lifecycle. A revision snapshot is written on
 * every transition.
 * Body: { action: "approve" | "reject" | "submit", scheduled_at? }
 *   - submit  : draft -> needs_approval
 *   - approve : draft/needs_approval -> scheduled (if scheduled_at set) else
 *               -> needs_approval (awaiting a schedule / review)
 *   - reject  : needs_approval -> draft
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
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

    const current = await svc.retrieveMarketingPost(id, {
      relations: ["targets"],
    })
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const from = (current as any).status as string
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
      const targets = ((current as any).targets ?? []) as any[]
      const hasSchedule =
        !!b.scheduled_at || targets.some((t) => !!t?.scheduled_at)
      to = hasSchedule ? "scheduled" : "needs_approval"
    }

    // Snapshot a revision for the transition.
    const [, revCount] = await svc.listAndCountMarketingPostRevisions(
      { tenant_id: TENANT_ID, post_id: id },
      { take: 1 }
    )
    await svc.createMarketingPostRevisions({
      tenant_id: TENANT_ID,
      post_id: id,
      version: (revCount ?? 0) + 1,
      snapshot: {
        action,
        from,
        to,
        title: (current as any).title ?? null,
        body: (current as any).body ?? null,
        hashtags: (current as any).hashtags ?? null,
        link_url: (current as any).link_url ?? null,
      },
      created_by_user_id: (req as any).auth_context?.actor_id ?? null,
    })

    await svc.updateMarketingPosts({ id, status: to } as any)

    // The UI consumes this response as a PostDetail — reload relations.
    const reloaded = await svc.retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json(
      toPostDetailDto(reloaded, {
        targets: (reloaded as any).targets ?? [],
        media: (reloaded as any).media ?? [],
        revisions: (reloaded as any).revisions ?? [],
      })
    )
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
