import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateProductTagsWorkflow,
  deleteProductTagsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateSchema = z.object({ value: z.string().trim().min(1) })

async function ownedTag(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_tag",
    filters: { id } as any,
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
  })
  const t = (data || [])[0]
  if (!t || t.metadata?.tenant_id !== tenantId) return null
  return t
}

async function inUseCount(
  req: MedusaRequest,
  scId: string | undefined,
  tagId: string
): Promise<number> {
  if (!scId) return 0
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  const pids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!pids.length) return 0
  const { data } = await query.graph({
    entity: "product",
    filters: { id: pids } as any,
    fields: ["id", "tags.id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  return (data || []).filter((p: any) =>
    (p.tags || []).some((t: any) => t?.id === tagId)
  ).length
}

const update = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await ownedTag(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "product tag not found" })

  const parsed = UpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { result } = await updateProductTagsWorkflow(req.scope).run({
    input: { selector: { id }, update: { value: parsed.data.value } },
  })

  const t = (result as any[])[0]
  res.json({
    tag: {
      id: t.id,
      value: t.value,
      created_at: t.created_at,
      updated_at: t.updated_at,
    },
  })
}

export const POST = update
export const PUT = update

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await ownedTag(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "product tag not found" })

  const used = await inUseCount(req, ctx.tenant.meta?.sales_channel_id, id)
  if (used > 0) {
    return res.status(409).json({
      message: `Cannot delete: ${used} product${
        used === 1 ? "" : "s"
      } still use this tag. Remove the tag from them first.`,
    })
  }

  await deleteProductTagsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "product_tag", deleted: true })
}
