import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

/**
 * Fetch a category's ownership tag via query.graph — the module-service
 * retrieve omits metadata, so the guard needs the remote query to read it.
 * Returns null unless the row belongs to this tenant.
 */
async function findOwnedCategory(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "metadata"],
    filters: { id } as any,
  })
  const category = (data || [])[0]
  if (!category || category.metadata?.tenant_id !== tenantId) return null
  return category
}

/**
 * DELETE /merchant/product-categories/:id
 *
 * Only product categories tagged with this tenant's metadata.tenant_id can be
 * deleted — other tenants' rows return 404.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const owned = await findOwnedCategory(req, ctx.tenant.id, id)
  if (!owned) return res.status(404).json({ message: "product category not found" })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  await productModule.deleteProductCategories([id])
  res.json({ id, object: "product_category", deleted: true })
}
