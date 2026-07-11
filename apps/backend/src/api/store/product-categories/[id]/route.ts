import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../../_tenant"

/**
 * GET /store/product-categories/:id  (tenant ownership guard)
 *
 * Returns the category ONLY when it belongs to the caller's tenant
 * (metadata.tenant_id === caller) and is not internal; otherwise 404.
 *
 * FAIL CLOSED: unresolved tenant, another tenant's category, or an internal
 * category all return 404.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const notFound = () =>
    res.status(404).json({ type: "not_found", message: `Category with id: ${id} was not found` })

  const tenant = await storeTenant(req)
  if (!tenant) return notFound()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "is_internal",
      "rank",
      "parent_category_id",
      "metadata",
      "created_at",
      "updated_at",
      "parent_category.id",
      "parent_category.name",
      "parent_category.handle",
      "category_children.id",
      "category_children.name",
      "category_children.handle",
      "category_children.is_active",
      "category_children.is_internal",
    ],
    filters: { id } as any,
  })

  const category = (data || [])[0]
  if (!category || category.metadata?.tenant_id !== tenant.id || category.is_internal === true) {
    return notFound()
  }

  const { metadata, ...rest } = category
  res.json({ product_category: rest })
}
