import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const JOURNEY_STATUSES = ["draft", "active", "paused", "archived"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

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

const UpdateJourneySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  trigger_event: z.string().min(1).optional(),
  status: z.enum(JOURNEY_STATUSES).optional(),
  steps: z.array(StepSchema).optional(),
  segment_filter: z.record(z.string(), z.any()).nullable().optional(),
  allow_reenroll: z.boolean().optional(),
  brand_voice_id: z.string().nullable().optional(),
})

/**
 * Load a journey and assert it belongs to the caller's tenant. Fail-closed and
 * null-safe: a missing row OR a tenant_id not strictly equal to the caller's
 * tenant (incl. null/undefined) 404s and returns null.
 */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const journey = await (svc as any)
    .retrieveMarketingJourney(id)
    .catch(() => null)
  if (!journey || journey.tenant_id !== tenantId) {
    res.status(404).json({ message: `Journey ${id} was not found` })
    return null
  }
  return journey
}

/**
 * GET /merchant/marketing/journeys/:id
 *
 * Retrieve a single journey (incl. its persisted `steps`) plus a breakdown of
 * enrollment counts by status. Tenant-scoped.
 * Response: { journey, enrollment_counts }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const journey = await loadOwned(svc, id, tenantId, res)
    if (!journey) return

    const [enrollments] = await svc.listAndCountMarketingJourneyEnrollments(
      { tenant_id: tenantId, journey_id: id },
      { take: 100000, select: ["status"] }
    )

    const enrollment_counts: Record<string, number> = {}
    for (const e of enrollments as any[]) {
      const s = e.status as string
      enrollment_counts[s] = (enrollment_counts[s] ?? 0) + 1
    }

    res.json({ journey, enrollment_counts })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve journey",
    })
  }
}

/**
 * PUT /merchant/marketing/journeys/:id
 *
 * Partially update a journey — edit name / description / trigger / steps and
 * change status (incl. activating it). Tenant-scoped. Only provided fields
 * change.
 * Body: { name?, description?, trigger_event?, steps?, segment_filter?,
 *         allow_reenroll?, status?, brand_voice_id? }
 * Response: { journey }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  const parsed = UpdateJourneySchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const b = parsed.data
    const data: Record<string, any> = {}
    if (b.name !== undefined) data.name = b.name
    if (b.description !== undefined) data.description = b.description ?? null
    if (b.trigger_event !== undefined) data.trigger_event = b.trigger_event
    if (b.steps !== undefined) data.steps = b.steps
    if (b.segment_filter !== undefined) {
      data.segment_filter = b.segment_filter ?? null
    }
    if (b.allow_reenroll !== undefined) {
      data.allow_reenroll = b.allow_reenroll === true
    }
    if (b.status !== undefined) data.status = b.status
    if (b.brand_voice_id !== undefined) {
      data.brand_voice_id = b.brand_voice_id ?? null
    }

    await (svc as any).updateMarketingJourneys({ id, ...data })
    const journey = await (svc as any).retrieveMarketingJourney(id)

    res.json({ journey })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to update journey",
    })
  }
}

/**
 * DELETE /merchant/marketing/journeys/:id
 *
 * Delete a journey (tenant-scoped). Verifies ownership before deleting.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    await (svc as any).deleteMarketingJourneys(id)

    res.json({ id, object: "marketing_journey", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete journey",
    })
  }
}
