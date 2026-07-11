import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../../_tenant"

/**
 * GET /store/collections/:id  (tenant ownership guard)
 *
 * Returns the collection ONLY when it belongs to the caller's tenant
 * (metadata.tenant_id === caller); otherwise 404.
 *
 * FAIL CLOSED: unresolved tenant or another tenant's collection both 404.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const notFound = () =>
    res.status(404).json({ type: "not_found", message: `Collection with id: ${id} was not found` })

  const tenant = await storeTenant(req)
  if (!tenant) return notFound()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_collection",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "created_at",
      "updated_at",
    ],
    filters: { id } as any,
  })

  const collection = (data || [])[0]
  if (!collection || collection.metadata?.tenant_id !== tenant.id) {
    return notFound()
  }

  const { metadata, ...rest } = collection
  res.json({ collection: rest })
}
