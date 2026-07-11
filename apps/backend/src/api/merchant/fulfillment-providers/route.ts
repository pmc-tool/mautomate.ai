import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { getQuery } from "../_shipping"

/**
 * GET /merchant/fulfillment-providers
 * Lists the fulfillment providers available on the platform (global, not
 * tenant-specific). Optionally filter to those enabled for a location via
 * ?location_id=.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = getQuery(req)
  const locationId = typeof req.query.location_id === "string" ? req.query.location_id : undefined

  // Providers enabled for a specific location are read from the stock_location
  // side (fulfillment_provider is not filterable by stock_location_id here).
  if (locationId) {
    const { data } = await query.graph({
      entity: "stock_location",
      filters: { id: locationId },
      fields: ["id", "fulfillment_providers.id", "fulfillment_providers.is_enabled"],
      pagination: { take: 1, skip: 0 } as any,
    })
    const providers = (data?.[0]?.fulfillment_providers || [])
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, is_enabled: p.is_enabled !== false }))
    return res.json({ fulfillment_providers: providers })
  }

  const { data } = await query.graph({
    entity: "fulfillment_provider",
    fields: ["id", "is_enabled"],
    filters: { is_enabled: true } as any,
    pagination: { take: 50, skip: 0 } as any,
  })

  res.json({
    fulfillment_providers: (data || []).map((p: any) => ({
      id: p.id,
      is_enabled: p.is_enabled !== false,
    })),
  })
}
