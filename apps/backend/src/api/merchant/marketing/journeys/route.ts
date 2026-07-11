import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"

/**
 * Typed journey step schema, mirroring modules/marketing/journey/types.ts.
 * The runner consumes these node types (wait / condition / action) once they
 * are persisted on marketing_journey.steps.
 */
const ConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "exists",
    "not_exists",
    "contains",
  ]),
  value: z.any().optional(),
})

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_email"),
    template_id: z.string().optional(),
    subject: z.string().optional(),
    html: z.string().optional(),
    brief: z.string().optional(),
    brand_voice_id: z.string().optional(),
  }),
  z.object({ type: z.literal("send_dm"), channel: z.string(), text: z.string() }),
  z.object({ type: z.literal("add_tag"), tag: z.string() }),
  z.object({ type: z.literal("remove_tag"), tag: z.string() }),
  z.object({ type: z.literal("add_score"), points: z.number() }),
  z.object({
    type: z.literal("discount"),
    percentage: z.number().optional(),
    amount: z.number().optional(),
    expires_hours: z.number().optional(),
  }),
  z.object({ type: z.literal("webhook"), url: z.string() }),
])

const StepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("wait"),
    delay_seconds: z.number(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal("condition"),
    condition: ConditionSchema,
    on_fail: z.enum(["exit", "skip"]).optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal("action"),
    action: ActionSchema,
    label: z.string().optional(),
  }),
])

const CreateJourneySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_event: z.string().min(1),
  status: z.string().optional().default("draft"),
  steps: z.array(StepSchema).optional(),
  segment_filter: z.record(z.string(), z.any()).optional(),
  allow_reenroll: z.boolean().optional(),
  brand_voice_id: z.string().optional(),
})

/**
 * GET /merchant/marketing/journeys
 *
 * Merchant-scoped list of marketing journeys. Query params: status, trigger_event, limit, offset.
 * Response: { journeys, count, limit, offset }
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
    if (req.query.trigger_event) {
      filters.trigger_event = req.query.trigger_event
    }

    const [journeys, count] = await svc.listAndCountMarketingJourneys(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ journeys, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list journeys",
    })
  }
}

/**
 * POST /merchant/marketing/journeys
 *
 * Create a merchant-scoped marketing journey. Accepts and PERSISTS a typed
 * `steps` array (wait / condition / action nodes) that the journey runner
 * executes once the journey is active.
 * Body: { name, description?, trigger_event, status?, steps?, segment_filter?,
 *         allow_reenroll?, brand_voice_id? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateJourneySchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const [journey] = await svc.createMarketingJourneys([
      {
        tenant_id: ctx.tenant.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        trigger_event: parsed.data.trigger_event,
        steps: (Array.isArray(parsed.data.steps) ? parsed.data.steps : []) as any,
        segment_filter: (parsed.data.segment_filter ?? null) as any,
        allow_reenroll: parsed.data.allow_reenroll === true,
        brand_voice_id: parsed.data.brand_voice_id || null,
        status: parsed.data.status as "draft" | "active" | "paused" | "archived",
      },
    ])

    res.status(201).json({ journey })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to create journey",
    })
  }
}
