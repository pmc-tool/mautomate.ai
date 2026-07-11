import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductOptionsWorkflow,
  setProductProductOptionsWorkflow,
  updateProductOptionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../../_helpers"

const UpdateOptionSchema = z
  .object({
    title: z.string().min(1).optional(),
    values: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((d) => d.title !== undefined || d.values !== undefined, {
    message: "provide a title and/or values to update",
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

/** The option, only when it is linked to this product. Null otherwise. */
async function loadOwnedOption(
  req: MedusaRequest,
  productId: string,
  optionId: string
): Promise<any | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_option",
    filters: { id: optionId } as any,
    fields: [
      "id",
      "title",
      "is_exclusive",
      "products.id",
      "values.id",
      "values.value",
    ],
  })
  const option = (data || [])[0]
  if (!option) return null
  const productIds = (option.products || []).map((p: any) => p?.id).filter(Boolean)
  if (!productIds.includes(productId)) return null
  return option
}

/** Option values (by value string) currently used by this product's variants. */
async function optionValuesUsedByVariants(
  req: MedusaRequest,
  productId: string,
  optionId: string
): Promise<Set<string>> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productId } as any,
    fields: [
      "id",
      "variants.id",
      "variants.options.id",
      "variants.options.value",
      "variants.options.option_id",
    ],
  })
  const used = new Set<string>()
  for (const variant of (data || [])[0]?.variants || []) {
    for (const optionValue of variant?.options || []) {
      if (optionValue?.option_id === optionId) {
        used.add(String(optionValue.value))
      }
    }
  }
  return used
}

async function refetchOption(req: MedusaRequest, optionId: string): Promise<any | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_option",
    filters: { id: optionId } as any,
    fields: ["id", "title", "values.id", "values.value", "values.rank"],
  })
  return (data || [])[0] ?? null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id, optionId } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const option = await loadOwnedOption(req, id, optionId)
  if (!option) return res.status(404).json({ message: "product option not found" })

  const parsed = UpdateOptionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  // Tenant isolation: an option linked to other products must not be mutated
  // from here (it would change those products too).
  if ((option.products || []).length > 1) {
    return res.status(400).json({
      message: "this option is shared with other products and cannot be edited from this product",
    })
  }

  const update: { title?: string; values?: string[] } = {}
  if (parsed.data.title !== undefined) {
    const title = parsed.data.title.trim()
    if (!title) return res.status(400).json({ message: "title cannot be empty" })
    update.title = title
  }
  if (parsed.data.values !== undefined) {
    const values = Array.from(
      new Set(parsed.data.values.map((v) => v.trim()).filter(Boolean))
    )
    if (!values.length) {
      return res.status(400).json({ message: "at least one value is required" })
    }

    // Values being removed must not be in use by variants.
    const nextValues = new Set(values)
    const removed = (option.values || [])
      .map((v: any) => String(v.value))
      .filter((value: string) => !nextValues.has(value))
    if (removed.length) {
      const used = await optionValuesUsedByVariants(req, id, optionId)
      const blocked = removed.filter((value: string) => used.has(value))
      if (blocked.length) {
        return res.status(400).json({
          message: `cannot remove option value(s) in use by variants: ${blocked.join(", ")}`,
        })
      }
    }
    update.values = values
  }

  try {
    if (update.values !== undefined) {
      // Maintain the product<->option-value pivot rows BEFORE updating the
      // option entity:
      //  - removed values: drop their product_product_option_value rows first,
      //    otherwise updateOptions_ rejects the shrink with "Cannot delete
      //    product option values that are associated with products." (the
      //    pivots exist for every value from option-link time, regardless of
      //    variant usage).
      //  - new values: create them AND their pivot rows via the update.add
      //    path ({ value } objects create-and-link); values created by
      //    updateProductOptionsWorkflow alone get no pivots, and variant
      //    create/update validates against the product's pivot subset, so
      //    unlinked values would be unusable on variants.
      //  - kept values: passed by id; already-linked ids are skipped by the
      //    module, and any missing pivots are healed.
      const currentByValue = new Map<string, string>(
        (option.values || []).map((v: any) => [String(v.value), String(v.id)])
      )
      const nextValues = new Set(update.values)
      const removeValueIds = (option.values || [])
        .filter((v: any) => !nextValues.has(String(v.value)))
        .map((v: any) => String(v.id))
      const addEntries = update.values.map((value) => {
        const existingId = currentByValue.get(value)
        return existingId ?? { value }
      })

      if (addEntries.length || removeValueIds.length) {
        await setProductProductOptionsWorkflow(req.scope).run({
          input: {
            product_id: id,
            update: [
              {
                product_option_id: optionId,
                ...(addEntries.length ? { add: addEntries } : {}),
                ...(removeValueIds.length ? { remove: removeValueIds } : {}),
              },
            ],
          },
        })
      }
    }

    // Now safe: removed values have no pivots left (deletable), added values
    // already exist and stay linked; this call applies the title and the
    // final value list/order on the option entity itself.
    await updateProductOptionsWorkflow(req.scope).run({
      input: {
        selector: { id: optionId },
        update,
      },
    })
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to update product option" })
  }

  const productOption = await refetchOption(req, optionId)
  res.status(200).json({
    product_option: productOption ?? { id: optionId, ...update },
  })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "product not found" })

  const { id, optionId } = req.params
  if (!(await productBelongsToSalesChannel(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const option = await loadOwnedOption(req, id, optionId)
  if (!option) return res.status(404).json({ message: "product option not found" })

  // Guard: options whose values are used by variants cannot be deleted; the
  // variants must be updated or removed first (Medusa admin behavior).
  const used = await optionValuesUsedByVariants(req, id, optionId)
  if (used.size) {
    return res.status(400).json({
      message: `cannot delete option "${option.title}" because its values are in use by variants: ${[...used].join(", ")}`,
    })
  }

  try {
    // Always unlink from THIS product first. The product module refuses to
    // delete an option while any live product_product_option row exists
    // (canDeleteProductOption), so deleting a linked option directly always
    // fails; unlinking drops the pivot rows for this product.
    await setProductProductOptionsWorkflow(req.scope).run({
      input: { product_id: id, remove: [optionId] },
    })

    if ((option.products || []).length <= 1) {
      // The option was exclusive to this product: delete the now-orphaned
      // option entity. Shared options (other tenants/products) are only
      // unlinked, never deleted.
      await deleteProductOptionsWorkflow(req.scope).run({
        input: { ids: [optionId] },
      })
    }
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "failed to delete product option" })
  }

  res.status(200).json({ id: optionId, object: "product_option", deleted: true })
}
