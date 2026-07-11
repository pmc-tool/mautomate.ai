import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { reworkPost } from "../../../../../../modules/marketing/content/content-service"
import { resolveMerchant } from "../../../../_helpers"
import { meterAction } from "../../../../../../modules/platform/integration/metering-guard"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/marketing/posts/:id/rework
 *
 * Rewrite an existing post's copy according to a free-text `instruction`
 * (e.g. "make it punchier"). Tenant-scoped.
 * Body: { instruction }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as { instruction?: string }

  try {
    const instruction = b.instruction?.trim()
    if (!instruction) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An `instruction` is required to rework a post."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await (svc as any)
      .retrieveMarketingPost(id)
      .catch(() => null)
    if (!current || current.tenant_id !== tenantId) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const metered = await meterAction(req.scope, tenantId, "ai_text", 1, async () => {
      const r = await reworkPost(req.scope, {
        postId: id,
        tenantId,
        instruction,
        userId: (req as any).auth_context?.actor_id ?? undefined,
      } as any)
      return { result: r, actualUnits: (r as any)?.needs_ai ? 0 : 1 }
    })
    if (!metered.ok) {
      res.status(402).json({
        message:
          "You're out of AI credits. Top up in Billing to rework content.",
        code: "insufficient_credits",
      })
      return
    }
    const result = metered.result

    if (!(result as any)?.post) {
      res.status(404).json({ message: `Post ${id} was not found` })
      return
    }

    const reloaded = await (svc as any).retrieveMarketingPost(id, {
      relations: ["targets", "media", "revisions"],
    })

    res.json({ post: reloaded, needs_ai: (result as any)?.needs_ai })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to rework post",
    })
  }
}
