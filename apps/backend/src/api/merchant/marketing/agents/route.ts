import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import {
  AUTONOMOUS_KINDS,
  listTextCapablePlatforms,
  validatePlaybook,
} from "../../../../modules/marketing/agents/playbook"
import { resolveMerchant } from "../../_helpers"

/**
 * Merchant marketing agents (marketing_agent) — the autonomous posters.
 *
 * An agent = identity (name/kind/instructions/model) + a BRAND VOICE +
 * a PLAYBOOK. The playbook is the full cadence/behaviour contract and is
 * defined, documented, and validated in
 * `modules/marketing/agents/playbook.ts`:
 *
 *   { platforms: string[], mode: "approval"|"auto",
 *     schedule_id?: string,                       // a marketing_schedule
 *     cadence?: { timezone, slots: [{day,time,platforms?}] },  // or inline
 *     topics?, post_types?, tone?, creativity?(1-10), hashtag_count?(0-30),
 *     cta_templates?, goals?, length?, daily_post_count?(1-20),
 *     campaign_id?, product_ids? }
 *
 * `jobs/marketing-agent-tick` runs every active content|social agent that has a
 * cadence, every 5 minutes.
 *
 * CAPABILITY GATE: a platform whose publish adapter requires media (instagram)
 * is rejected with a 400 naming it — agent posts are text-only today, so such an
 * agent would be guaranteed to fail at publish time.
 */

const KINDS = AUTONOMOUS_KINDS as readonly string[]

/** Validate `brand_voice_id` / `playbook.schedule_id` belong to this tenant. */
const assertReferences = async (
  svc: MarketingModuleService,
  tenantId: string,
  brandVoiceId: string | null,
  scheduleId?: string
): Promise<void> => {
  if (brandVoiceId) {
    const bv = await (svc as any)
      .retrieveMarketingBrandVoice(brandVoiceId)
      .catch(() => null)
    if (!bv || bv.tenant_id !== tenantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Brand voice ${brandVoiceId} was not found.`
      )
    }
  }
  if (scheduleId) {
    const s = await (svc as any)
      .retrieveMarketingSchedule(scheduleId)
      .catch(() => null)
    if (!s || s.tenant_id !== tenantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Schedule ${scheduleId} was not found.`
      )
    }
  }
}

/**
 * GET /merchant/marketing/agents
 *
 * Paginated list of the tenant's agents. Query: kind, active, limit, offset.
 * Response: { agents, count, limit, offset, supported_platforms }
 * `supported_platforms` is what an agent may post to (the capability gate), so
 * the UI can offer exactly those.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: ctx.tenant.id }
    if (req.query.kind) {
      filters.kind = req.query.kind
    }
    if (req.query.active !== undefined) {
      filters.active = req.query.active === "true" || req.query.active === "1"
    }

    const [agents, count] = await svc.listAndCountMarketingAgents(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({
      agents,
      count,
      limit,
      offset,
      supported_platforms: listTextCapablePlatforms(),
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list agents" })
  }
}

/**
 * POST /merchant/marketing/agents
 *
 * Create an autonomous marketing agent.
 * Body: { name, kind?("content"|"social"), instructions?, model?,
 *         brand_voice_id?, active?, playbook }
 * Response: { agent }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>

  try {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An agent requires a `name`."
      )
    }

    const kind = b.kind === undefined || b.kind === null ? "content" : String(b.kind)
    if (!KINDS.includes(kind)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `\`kind\` must be one of: ${KINDS.join(", ")}.`
      )
    }

    if (b.playbook === undefined || b.playbook === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An agent requires a `playbook` (at minimum { platforms, mode })."
      )
    }
    const playbook = validatePlaybook(b.playbook)

    const brand_voice_id =
      typeof b.brand_voice_id === "string" && b.brand_voice_id.trim()
        ? b.brand_voice_id.trim()
        : null

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    await assertReferences(
      svc,
      ctx.tenant.id,
      brand_voice_id,
      playbook.schedule_id
    )

    const created = await svc.createMarketingAgents({
      tenant_id: ctx.tenant.id,
      name,
      kind,
      instructions:
        typeof b.instructions === "string" ? b.instructions.trim() || null : null,
      model: typeof b.model === "string" && b.model.trim() ? b.model.trim() : null,
      brand_voice_id,
      playbook,
      tools: Array.isArray(b.tools) ? b.tools : null,
      active: b.active === undefined ? true : b.active === true,
    } as any)

    const agent = Array.isArray(created) ? created[0] : created

    res.status(201).json({ agent })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({ message: e?.message ?? "Failed to create agent" })
  }
}
