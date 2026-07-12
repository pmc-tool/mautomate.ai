import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateRefundReasonsWorkflow,
  deleteRefundReasonsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateSchema = z.object({
  label: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
})

function slugCode(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function format(r: any) {
  return {
    id: r.id,
    label: r.label,
    code: r.code,
    description: r.description ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

async function ownedReason(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "refund_reason",
    filters: { id } as any,
    fields: [
      "id",
      "label",
      "code",
      "description",
      "metadata",
      "created_at",
      "updated_at",
    ],
  })
  const r = (data || [])[0]
  if (!r || r.metadata?.tenant_id !== tenantId) return null
  return r
}

const update = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await ownedReason(req, ctx.tenant.id, id)
  if (!existing) {
    return res.status(404).json({ message: "refund reason not found" })
  }

  const parsed = UpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const patch: Record<string, any> = { id }
  if (parsed.data.label !== undefined) patch.label = parsed.data.label
  if (parsed.data.code !== undefined) patch.code = slugCode(parsed.data.code)
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description || null
  }

  const { result } = await updateRefundReasonsWorkflow(req.scope).run({
    input: [patch],
  })

  res.json({ refund_reason: format((result as any[])[0]) })
}

export const POST = update
export const PUT = update

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await ownedReason(req, ctx.tenant.id, id)
  if (!existing) {
    return res.status(404).json({ message: "refund reason not found" })
  }

  await deleteRefundReasonsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "refund_reason", deleted: true })
}
