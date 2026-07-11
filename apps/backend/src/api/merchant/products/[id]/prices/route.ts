import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const PriceSchema = z.object({
  currency_code: z.string().min(3).max(3),
  amount: z.number().min(0).finite(),
})

const BatchPricesSchema = z.object({
  updates: z
    .array(
      z.object({
        variant_id: z.string().min(1),
        prices: z.array(PriceSchema),
      })
    )
    .min(1),
})

async function productBelongsToSalesChannel(
  req: MedusaRequest,
  productId: string,
  scId: string
): Promise<boolean> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId, product_id: productId } as any,
    fields: ["product_id"],
  })
  return (links || []).length > 0
}

function workflowErrorStatus(e: any): number {
  const type = e?.type
  if (type === "not_found") return 404
  if (["invalid_data", "not_allowed", "duplicate_error", "invalid_argument"].includes(type)) {
    return 400
  }
  return 500
}

/**
 * POST /merchant/products/[id]/prices
 *
 * Batch price update for a tenant-owned product's variants. Each entry
 * REPLACES that variant's full price set with the given currency prices
 * (MAJOR units). Body: { updates: [{ variant_id, prices: [{ currency_code,
 * amount }] }] }.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const parsed = BatchPricesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { updates } = parsed.data

  // Every targeted variant must belong to THIS product (which is already
  // proven to belong to the tenant's sales channel above).
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: productVariants } = await query.graph({
    entity: "product_variant",
    filters: { product_id: id } as any,
    fields: ["id"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  const validVariantIds = new Set((productVariants || []).map((v: any) => v.id))
  for (const u of updates) {
    if (!validVariantIds.has(u.variant_id)) {
      return res.status(404).json({ message: `variant ${u.variant_id} not found on this product` })
    }
  }

  // Dedupe by variant id (last entry wins) so one workflow call handles all.
  const byVariant = new Map<string, { currency_code: string; amount: number }[]>()
  for (const u of updates) {
    byVariant.set(
      u.variant_id,
      u.prices.map((p) => ({
        amount: p.amount,
        currency_code: p.currency_code.toLowerCase(),
      }))
    )
  }

  try {
    await updateProductVariantsWorkflow(req.scope).run({
      input: {
        product_variants: [...byVariant.entries()].map(([variantId, prices]) => ({
          id: variantId,
          prices,
        })),
      },
    })
    return res.json({ ok: true })
  } catch (e: any) {
    return res
      .status(workflowErrorStatus(e))
      .json({ message: e?.message || "failed to update prices" })
  }
}
