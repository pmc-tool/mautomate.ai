import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateReturnReasonSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
})

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

async function findOwnedReason(req: MedusaRequest, tenantId: string, id: string) {
  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const reason = await orderModule.retrieveReturnReason(id).catch(() => null)
  if (!reason || reason.metadata?.tenant_id !== tenantId) return null
  return reason
}

/**
 * PUT /merchant/return-reasons/:id
 *
 * Only return reasons tagged with this tenant's metadata.tenant_id can be
 * updated — other tenants' rows return 404.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const reason = await findOwnedReason(req, ctx.tenant.id, id)
  if (!reason) return res.status(404).json({ message: "return reason not found" })

  const parsed = UpdateReturnReasonSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const updated = await orderModule.updateReturnReasons(id, {
    label: parsed.data.label ?? undefined,
    description:
      parsed.data.description === undefined ? undefined : parsed.data.description,
  })

  res.json({ return_reason: formatReturnReason(updated) })
}

/**
 * DELETE /merchant/return-reasons/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const reason = await findOwnedReason(req, ctx.tenant.id, id)
  if (!reason) return res.status(404).json({ message: "return reason not found" })

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.deleteReturnReasons([id])

  res.json({ id, object: "return_reason", deleted: true })
}
