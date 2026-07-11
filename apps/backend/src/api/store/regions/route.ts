import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../_tenant"

/**
 * GET /store/regions  (tenant-scoped override of the built-in store route)
 *
 * The stock Medusa /store/regions endpoint is NOT sales-channel scoped and
 * returns EVERY tenant's region — leaking each store's name + currency to any
 * publishable key. This override scopes the listing to the caller's tenant:
 * returns ONLY regions that are the tenant's dedicated region
 * (tenant.meta.region_id) or are tagged with metadata.tenant_id === caller.
 *
 * FAIL CLOSED: if the caller's tenant cannot be resolved (missing/invalid
 * publishable key), an EMPTY list is returned — never all regions. Untagged
 * legacy regions (e.g. the default "United States") belong to no tenant and are
 * therefore never exposed.
 *
 * Uses query.graph so `metadata` is actually returned — the region
 * module-service list omits metadata when relations are requested, which would
 * make the owner filter match nothing.
 *
 * Response shape { regions, count, offset, limit } and the limit/offset query
 * params are preserved so the storefront SDK keeps working. `metadata` is
 * stripped from the output.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const offset = Number(req.query.offset ?? 0) || 0
  const rawLimit = req.query.limit != null ? Number(req.query.limit) : undefined
  const limit = rawLimit && rawLimit > 0 ? rawLimit : undefined

  const tenant = await storeTenant(req)
  if (!tenant) {
    return res.json({ regions: [], count: 0, offset, limit: limit ?? 0 })
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
    pagination: { take: 1000, skip: 0 } as any,
  })

  const owned = (data || []).filter(
    (r: any) =>
      (!!tenant.region_id && r.id === tenant.region_id) ||
      r.metadata?.tenant_id === tenant.id
  )

  const count = owned.length
  const paged =
    limit != null ? owned.slice(offset, offset + limit) : owned.slice(offset)

  res.json({
    regions: paged.map(({ metadata, ...rest }: any) => rest),
    count,
    offset,
    limit: limit ?? count,
  })
}
