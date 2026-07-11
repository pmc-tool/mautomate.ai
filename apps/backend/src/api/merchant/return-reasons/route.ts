import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const CreateReturnReasonSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
}

function formatReturnReason(reason: any) {
  return {
    id: reason.id,
    value: reason.value,
    label: reason.label,
    description: reason.description ?? null,
    created_at: reason.created_at,
    updated_at: reason.updated_at,
  }
}

/**
 * GET /merchant/return-reasons
 *
 * Return reasons are GLOBAL in Medusa, so rows are tagged with
 * metadata.tenant_id at creation and only this tenant's rows are returned.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const all = await orderModule.listReturnReasons(
    {},
    { take: 500, skip: 0, order: { created_at: "DESC" } }
  )
  const reasons = (all || []).filter(
    (r: any) => r.metadata?.tenant_id === ctx.tenant.id
  )

  res.json({
    return_reasons: reasons.map(formatReturnReason),
    count: reasons.length,
  })
}

/**
 * POST /merchant/return-reasons
 *
 * Return reason values are unique across the whole Medusa instance, so
 * creation fails with 400 if any tenant already claimed the value.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateReturnReasonSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const value = slugifyValue(parsed.data.value)
  if (!value) {
    return res.status(400).json({ message: "value must contain letters or numbers" })
  }

  const orderModule: any = req.scope.resolve(Modules.ORDER)

  const existing = await orderModule.listReturnReasons({ value }, { take: 1 })
  if (existing?.length) {
    return res.status(400).json({ message: "a return reason with this value already exists" })
  }

  try {
    const reason = await orderModule.createReturnReasons({
      value,
      label: parsed.data.label,
      description: parsed.data.description || undefined,
      metadata: { tenant_id: ctx.tenant.id },
    })

    res.status(201).json({ return_reason: formatReturnReason(reason) })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create return reason" })
  }
}
