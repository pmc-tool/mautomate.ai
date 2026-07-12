import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import {
  generateForAgentSlot,
  loadAgentHistory,
  zonedStamp,
} from "../../../../../../modules/marketing/agents/agent-runner"
import {
  isTextCapablePlatform,
  validatePlaybook,
  type AgentPlaybook,
} from "../../../../../../modules/marketing/agents/playbook"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/marketing/agents/:id/generate
 *
 * "Generate now" — run the agent's generation on demand, exactly as the
 * `marketing-agent-tick` job runs it (same prompt, same brand grounding, same
 * variety back-feed, same metering, same placement), for `count` posts at the
 * current time instead of at a cadence slot.
 *
 * Placement follows the agent's playbook mode, like the tick:
 *   approval -> "needs_approval" (review kanban)
 *   auto     -> "scheduled" at now, so the publish sweep ships it on its next
 *               minute. Merchants who do not want that should keep the agent in
 *               approval mode.
 *
 * The tick's slot dedup does NOT apply here: this is an explicit human action,
 * so N presses produce N posts.
 *
 * Body: { count?: 1..10, platform?: string }
 * Response: { posts, count, needs_ai }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as { count?: number; platform?: string }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const agent = await (svc as any)
      .retrieveMarketingAgent(id)
      .catch(() => null)
    if (!agent || agent.tenant_id !== tenantId) {
      res.status(404).json({ message: `Agent ${id} was not found` })
      return
    }

    const count = b.count === undefined ? 1 : Number(b.count)
    if (!Number.isFinite(count) || count < 1 || count > 10) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`count` must be a number between 1 and 10."
      )
    }

    // Re-validate the stored playbook so a legacy/hand-edited row cannot drive a
    // generation that could never publish.
    const playbook: AgentPlaybook = validatePlaybook(agent.playbook)

    let platforms = playbook.platforms
    if (b.platform) {
      const platform = String(b.platform).trim()
      if (!playbook.platforms.includes(platform)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `\`platform\`: "${platform}" is not one of this agent's platforms (${playbook.platforms.join(
            ", "
          )}).`
        )
      }
      platforms = [platform]
    }
    platforms = platforms.filter((p) => isTextCapablePlatform(p))
    if (!platforms.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This agent has no platform that can carry a text-only post."
      )
    }

    const timezone = playbook.cadence?.timezone ?? "UTC"
    const history = await loadAgentHistory(
      req.scope,
      tenantId,
      agent.id,
      timezone
    )

    const posts: any[] = []
    let needsAi = false
    let rotationIndex = history.total

    for (let i = 0; i < Math.round(count); i++) {
      const now = new Date()
      const outcome = await generateForAgentSlot(req.scope, {
        tenantId,
        agent,
        playbook,
        platforms,
        slotAt: now,
        stamp: zonedStamp(timezone, now),
        recent: history.recent,
        rotationIndex,
        idempotencyKey: `marketing_agent_generate:${agent.id}:${now.getTime()}:${i}`,
      })

      if (!outcome.ok) {
        if (outcome.reason === "no_credits") {
          if (posts.length) {
            break
          }
          return res.status(402).json({
            message:
              "You're out of AI credits. Top up in Billing to generate content.",
            code: "insufficient_credits",
          })
        }
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, outcome.message)
      }

      posts.push(outcome.post)
      needsAi = needsAi || outcome.needs_ai === true
      rotationIndex += 1

      const body = outcome.post?.body
      if (typeof body === "string" && body.trim()) {
        history.recent.unshift(body)
        history.recent = history.recent.slice(0, 10)
      }
    }

    res.status(201).json({ posts, count: posts.length, needs_ai: needsAi })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res
      .status(isNotFound(e) ? 404 : status)
      .json({ message: e?.message ?? "Failed to generate posts" })
  }
}
