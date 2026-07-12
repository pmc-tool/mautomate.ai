import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const ReorderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        rank: z.number().int().min(0),
        parent_category_id: z.string().nullable().optional(),
      })
    )
    .min(1),
})

/**
 * Load the tenant_id tag for a set of categories in one query.graph call.
 * Returns the set of ids that belong to this tenant (fail-closed: untagged or
 * other-tenant rows are excluded).
 */
async function ownedCategoryIds(
  req: MedusaRequest,
  tenantId: string,
  ids: string[]
): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "metadata"],
    filters: { id: ids } as any,
  })
  return new Set(
    (data || [])
      .filter((c: any) => c.metadata?.tenant_id === tenantId)
      .map((c: any) => c.id)
  )
}

/**
 * POST /merchant/product-categories/reorder
 *
 * Apply rank (and optional re-parent) changes to a batch of categories. Every
 * category being moved AND every non-null parent must be owned by this tenant,
 * or the whole request is rejected before any update runs. Updates are applied
 * per-category via updateProductCategoriesWorkflow.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = ReorderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { updates } = parsed.data

  const movedIds = updates.map((u) => u.id)
  const parentIds = updates
    .map((u) => u.parent_category_id)
    .filter((p): p is string => typeof p === "string" && p.length > 0)
  const idsToVerify = Array.from(new Set([...movedIds, ...parentIds]))

  const owned = await ownedCategoryIds(req, ctx.tenant.id, idsToVerify)
  if (!idsToVerify.every((id) => owned.has(id))) {
    return res.status(404).json({ message: "one or more categories not found" })
  }

  for (const u of updates) {
    if (u.parent_category_id === u.id) {
      return res
        .status(400)
        .json({ message: "a category cannot be its own parent" })
    }
    const update: any = { rank: u.rank }
    if (u.parent_category_id !== undefined) {
      update.parent_category_id = u.parent_category_id
    }
    await updateProductCategoriesWorkflow(req.scope).run({
      input: { selector: { id: u.id }, update },
    })
  }

  res.json({ success: true, count: updates.length })
}
