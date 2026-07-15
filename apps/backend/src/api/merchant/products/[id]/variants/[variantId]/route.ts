import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  deleteProductVariantsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../../_helpers"

const PriceSchema = z.object({
  currency_code: z.string().min(3).max(3),
  amount: z.number().min(0).finite(),
})

const UpdateVariantSchema = z.object({
  title: z.string().min(1).optional(),
  // The variant's own thumbnail — a URL already in the product's gallery.
  thumbnail: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  upc: z.string().nullable().optional(),
  manage_inventory: z.boolean().optional(),
  allow_backorder: z.boolean().optional(),
  options: z.record(z.string(), z.string().min(1)).optional(),
  prices: z.array(PriceSchema).optional(),
  weight: z.number().finite().nullable().optional(),
  length: z.number().finite().nullable().optional(),
  height: z.number().finite().nullable().optional(),
  width: z.number().finite().nullable().optional(),
  mid_code: z.string().nullable().optional(),
  hs_code: z.string().nullable().optional(),
  origin_country: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
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

async function variantBelongsToProduct(
  req: MedusaRequest,
  variantId: string,
  productId: string
): Promise<boolean> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: variantId, product_id: productId } as any,
    fields: ["id"],
  })
  return (variants || []).length > 0
}

function workflowErrorStatus(e: any): number {
  const type = e?.type
  if (type === "not_found") return 404
  if (["invalid_data", "not_allowed", "duplicate_error", "invalid_argument"].includes(type)) {
    return 400
  }
  return 500
}

type Ownership =
  | { ok: true }
  | { ok: false; status: number; message: string }

async function checkOwnership(req: MedusaRequest): Promise<Ownership> {
  const ctx = await resolveMerchant(req)
  if (!ctx) return { ok: false, status: 401, message: "not authorized" }
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { ok: false, status: 404, message: "product not found" }

  const { id, variantId } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return { ok: false, status: 404, message: "product not found" }
  }
  if (!(await variantBelongsToProduct(req, variantId, id))) {
    return { ok: false, status: 404, message: "variant not found" }
  }
  return { ok: true }
}

/**
 * POST /merchant/products/[id]/variants/[variantId]
 *
 * Partial update of a tenant-owned variant. Prices, when provided, REPLACE the
 * variant's full price set (MAJOR units). Empty strings on nullable text fields
 * clear the value.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ownership = await checkOwnership(req)
  if (!ownership.ok) {
    return res.status(ownership.status).json({ message: ownership.message })
  }

  const { id, variantId } = req.params

  const parsed = UpdateVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const body = parsed.data

  const update: any = { id: variantId }

  if (body.title !== undefined) update.title = body.title
  if (body.thumbnail !== undefined) {
    update.thumbnail =
      body.thumbnail === null || body.thumbnail.trim() === ''
        ? null
        : body.thumbnail
  }

  const nullableStringKeys = [
    "material",
    "sku",
    "barcode",
    "ean",
    "upc",
    "mid_code",
    "hs_code",
    "origin_country",
  ] as const
  for (const key of nullableStringKeys) {
    const value = body[key]
    if (value !== undefined) {
      update[key] = value === null || value.trim() === "" ? null : value
    }
  }

  const numberKeys = ["weight", "length", "height", "width"] as const
  for (const key of numberKeys) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (body.manage_inventory !== undefined) update.manage_inventory = body.manage_inventory
  if (body.allow_backorder !== undefined) update.allow_backorder = body.allow_backorder
  if (body.metadata !== undefined) update.metadata = body.metadata

  if (body.options !== undefined) {
    // Validate against the product's real options/values for a clear 400.
    const productModule: any = req.scope.resolve(Modules.PRODUCT)
    let product: any
    try {
      product = await productModule.retrieveProduct(id, {
        relations: ["options", "options.values"],
      })
    } catch {
      return res.status(404).json({ message: "product not found" })
    }
    const productOptions: any[] = product.options || []
    const optionByTitle = new Map<string, any>(productOptions.map((o: any) => [o.title, o]))
    for (const key of Object.keys(body.options)) {
      const opt = optionByTitle.get(key)
      if (!opt) {
        return res.status(400).json({ message: `Option "${key}" does not exist on this product` })
      }
      const values = (opt.values || []).map((v: any) => v.value)
      if (!values.includes(body.options[key])) {
        return res.status(400).json({
          message: `"${body.options[key]}" is not a value of option "${key}"`,
        })
      }
    }
    update.options = body.options
  }

  if (body.prices !== undefined) {
    update.prices = body.prices.map((p) => ({
      amount: p.amount,
      currency_code: p.currency_code.toLowerCase(),
    }))
  }

  if (Object.keys(update).length === 1) {
    return res.status(400).json({ message: "no fields to update" })
  }

  try {
    const { result } = await updateProductVariantsWorkflow(req.scope).run({
      input: { product_variants: [update] },
    })
    const variant = (result as any[])[0] || { id: variantId }
    return res.json({ variant })
  } catch (e: any) {
    return res
      .status(workflowErrorStatus(e))
      .json({ message: e?.message || "failed to update variant" })
  }
}

/**
 * DELETE /merchant/products/[id]/variants/[variantId]
 *
 * Delete a tenant-owned variant (soft delete via workflow; linked inventory
 * items are handled by the workflow itself).
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ownership = await checkOwnership(req)
  if (!ownership.ok) {
    return res.status(ownership.status).json({ message: ownership.message })
  }

  const { variantId } = req.params

  try {
    await deleteProductVariantsWorkflow(req.scope).run({
      input: { ids: [variantId] },
    })
    return res.json({ id: variantId, object: "variant", deleted: true })
  } catch (e: any) {
    return res
      .status(workflowErrorStatus(e))
      .json({ message: e?.message || "failed to delete variant" })
  }
}
