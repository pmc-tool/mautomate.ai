import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchImageVariantsWorkflow } from "@medusajs/core-flows"

import { resolveMerchant } from "../../../../../_helpers"

/* ------------------------------------------------------------------ */
/* Which VARIANTS an image belongs to.                                  */
/*                                                                     */
/* Medusa's model (and ours — same link table, same workflow): images   */
/* live on the PRODUCT, and each image is linked to zero or more of     */
/* that product's variants. A shopper picking "Red" then sees the red   */
/* photos. There is no "upload an image onto a variant" — an image is   */
/* uploaded once to the product and tagged with the variants it shows.  */
/*                                                                     */
/* POST { add?: string[], remove?: string[] } — variant ids.            */
/* Every id is checked against THIS product before anything is linked,  */
/* so a merchant can't attach their image to another store's variant.   */
/* ------------------------------------------------------------------ */

/** The product must be in the caller's sales channel (their store). */
async function productInStore(
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

/** The image and every named variant must belong to THIS product. */
async function readProduct(req: MedusaRequest, productId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productId } as any,
    fields: ["id", "images.id", "variants.id"],
  })
  return data?.[0] as
    | { id: string; images?: { id: string }[]; variants?: { id: string }[] }
    | undefined
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "not authorized" })
  }
  const scId = (ctx.tenant.meta as any)?.sales_channel_id
  if (!scId) {
    return res.status(404).json({ message: "product not found" })
  }

  const { id, imageId } = req.params as { id: string; imageId: string }
  if (!(await productInStore(req, id, scId))) {
    return res.status(404).json({ message: "product not found" })
  }

  const product = await readProduct(req, id)
  if (!product) {
    return res.status(404).json({ message: "product not found" })
  }

  // The image must be one of THIS product's images.
  if (!(product.images ?? []).some((img) => img.id === imageId)) {
    return res.status(404).json({ message: "image not found on this product" })
  }

  const body = (req.body ?? {}) as { add?: unknown; remove?: unknown }
  const asIds = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []
  const add = asIds(body.add)
  const remove = asIds(body.remove)

  if (!add.length && !remove.length) {
    return res.status(400).json({ message: "nothing to add or remove" })
  }

  // Every variant named must belong to this product — the whole request is
  // rejected if any does not, rather than silently linking the valid subset.
  const ownVariants = new Set((product.variants ?? []).map((v) => v.id))
  const unknown = [...add, ...remove].filter((v) => !ownVariants.has(v))
  if (unknown.length) {
    return res.status(400).json({
      message: `variant(s) do not belong to this product: ${unknown.join(", ")}`,
    })
  }

  const { result } = await batchImageVariantsWorkflow(req.scope).run({
    input: { image_id: imageId, add, remove },
  })

  res.status(200).json({
    added: (result as any)?.added ?? [],
    removed: (result as any)?.removed ?? [],
  })
}
