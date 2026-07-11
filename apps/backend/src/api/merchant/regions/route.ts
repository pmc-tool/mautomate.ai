import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/regions
 *
 * Returns the tenant's region — resolved DIRECTLY by ctx.tenant.meta.region_id
 * (the shared "Platform" region in the pooled model). Querying by id is precise
 * and scale-safe (no fetch-all-then-filter truncation). Fail-closed: empty list
 * when the tenant has no region_id.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const regionId = ctx.tenant.meta?.region_id
  if (!regionId) return res.json({ regions: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "region",
    filters: { id: regionId } as any,
    fields: [
      "id",
      "name",
      "currency_code",
      "metadata",
      "countries.iso_2",
      "countries.name",
      "countries.display_name",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const regions = (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    currency_code: r.currency_code,
    countries: (r.countries || []).map((c: any) => ({
      iso_2: c.iso_2,
      name: c.name,
      display_name: c.display_name || c.name,
    })),
    payment_providers: [],
    fulfillment_providers: [],
  }))

  res.json({ regions, count: regions.length })
}
