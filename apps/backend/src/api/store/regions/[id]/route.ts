import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../../_tenant"

/**
 * GET /store/regions/:id  (tenant ownership guard)
 *
 * The stock detail route returns any region by id regardless of tenant. This
 * override returns the region ONLY when it belongs to the caller's tenant
 * (tenant.meta.region_id or metadata.tenant_id === caller); otherwise 404.
 *
 * FAIL CLOSED: unresolved tenant, or a region owned by another tenant, both
 * return 404 — never another store's region.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const tenant = await storeTenant(req)
  if (!tenant) {
    return res.status(404).json({ type: "not_found", message: `Region with id: ${id} was not found` })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "region",
    fields: [
      "id",
      "name",
      "currency_code",
      "automatic_taxes",
      "metadata",
      "created_at",
      "updated_at",
      "countries.iso_2",
      "countries.iso_3",
      "countries.num_code",
      "countries.name",
      "countries.display_name",
      "countries.region_id",
      "payment_providers.id",
      "payment_providers.is_enabled",
    ],
    filters: { id } as any,
  })

  const region = (data || [])[0]
  const owned =
    region &&
    ((!!tenant.region_id && region.id === tenant.region_id) ||
      region.metadata?.tenant_id === tenant.id)

  if (!owned) {
    return res.status(404).json({ type: "not_found", message: `Region with id: ${id} was not found` })
  }

  const { metadata, ...rest } = region
  res.json({ region: rest })
}
