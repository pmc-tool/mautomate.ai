import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductOptionsWorkflow,
  deleteProductOptionsWorkflow,
  setProductProductOptionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const CreateOptionSchema = z.object({
  title: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const parsed = CreateOptionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const title = parsed.data.title.trim()
  const values = Array.from(
    new Set(parsed.data.values.map((v) => v.trim()).filter(Boolean))
  )
  if (!title || !values.length) {
    return res.status(400).json({ message: "title and at least one value are required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    filters: { id } as any,
    fields: ["id", "options.id", "options.title"],
  })
  const product = (products || [])[0]
  if (!product) return res.status(404).json({ message: "product not found" })

  const titleLower = title.toLowerCase()
  const duplicate = (product.options || []).some(
    (o: any) => String(o?.title ?? "").trim().toLowerCase() === titleLower
  )
  if (duplicate) {
    return res.status(400).json({
      message: `an option titled "${title}" already exists on this product`,
    })
  }

  // Create the option as EXCLUSIVE to this product (tenant isolation: it must
  // never appear in other tenants' shared option pickers), then link it.
  let optionId: string | undefined
  try {
    const { result } = await createProductOptionsWorkflow(req.scope).run({
      input: {
        product_options: [{ title, values, is_exclusive: true }],
      },
    })
    optionId = (result as any[])[0]?.id
    if (!optionId) {
      throw new Error("product option was not created")
    }
    await setProductProductOptionsWorkflow(req.scope).run({
      input: { product_id: id, add: [optionId] },
    })
  } catch (e: any) {
    // Linking failed after creation: clean up the orphaned exclusive option.
    if (optionId) {
      try {
        await deleteProductOptionsWorkflow(req.scope).run({
          input: { ids: [optionId] },
        })
      } catch {
        // best effort cleanup; surface the original error below
      }
    }
    return res.status(400).json({ message: e?.message || "failed to create product option" })
  }

  const { data: created } = await query.graph({
    entity: "product_option",
    filters: { id: optionId } as any,
    fields: ["id", "title", "values.id", "values.value", "values.rank"],
  })
  const productOption = (created || [])[0] ?? { id: optionId, title, values: [] }

  res.status(200).json({ product_option: productOption })
}
