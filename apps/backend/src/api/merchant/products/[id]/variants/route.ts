import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductVariantsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const PriceSchema = z.object({
  currency_code: z.string().min(3).max(3),
  amount: z.number().min(0).finite(),
})

const CreateVariantSchema = z.object({
  title: z.string().min(1).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  ean: z.string().optional(),
  upc: z.string().optional(),
  manage_inventory: z.boolean().optional().default(true),
  allow_backorder: z.boolean().optional().default(false),
  options: z.record(z.string(), z.string().min(1)),
  prices: z.array(PriceSchema).optional().default([]),
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

// Map thrown MedusaErrors from workflows to sane HTTP statuses.
function workflowErrorStatus(e: any): number {
  const type = e?.type
  if (type === "not_found") return 404
  if (["invalid_data", "not_allowed", "duplicate_error", "invalid_argument"].includes(type)) {
    return 400
  }
  return 500
}

const normalizeOptional = (s?: string): string | undefined =>
  s === undefined || s.trim() === "" ? undefined : s

/**
 * POST /merchant/products/[id]/variants
 *
 * Create a variant on a tenant-owned product. Options must cover every product
 * option with an existing value. Prices are MAJOR units.
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

  const parsed = CreateVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { title, sku, barcode, ean, upc, manage_inventory, allow_backorder, options, prices } =
    parsed.data

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  let product: any
  try {
    product = await productModule.retrieveProduct(id, {
      relations: ["options", "options.values"],
    })
  } catch {
    return res.status(404).json({ message: "product not found" })
  }

  // Validate the options record against the product's real options/values so
  // the merchant gets a clear 400 instead of a workflow internals error.
  const productOptions: any[] = product.options || []
  const optionByTitle = new Map<string, any>(productOptions.map((o: any) => [o.title, o]))
  for (const key of Object.keys(options)) {
    const opt = optionByTitle.get(key)
    if (!opt) {
      return res.status(400).json({ message: `Option "${key}" does not exist on this product` })
    }
    const values = (opt.values || []).map((v: any) => v.value)
    if (!values.includes(options[key])) {
      return res.status(400).json({
        message: `"${options[key]}" is not a value of option "${key}"`,
      })
    }
  }
  for (const opt of productOptions) {
    if (!(opt.title in options)) {
      return res.status(400).json({ message: `A value for option "${opt.title}" is required` })
    }
  }

  const variantTitle =
    normalizeOptional(title) ||
    productOptions
      .map((o: any) => options[o.title])
      .filter(Boolean)
      .join(" / ") ||
    "Default"

  try {
    const { result } = await createProductVariantsWorkflow(req.scope).run({
      input: {
        product_variants: [
          {
            product_id: id,
            title: variantTitle,
            sku: normalizeOptional(sku),
            barcode: normalizeOptional(barcode),
            ean: normalizeOptional(ean),
            upc: normalizeOptional(upc),
            manage_inventory,
            allow_backorder,
            options,
            prices: prices.map((p) => ({
              amount: p.amount,
              currency_code: p.currency_code.toLowerCase(),
            })),
          } as any,
        ],
      },
    })
    const variant = (result as any[])[0]
    return res.status(201).json({ variant })
  } catch (e: any) {
    return res
      .status(workflowErrorStatus(e))
      .json({ message: e?.message || "failed to create variant" })
  }
}
