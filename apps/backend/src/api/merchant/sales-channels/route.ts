import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { getQuery } from "../_shipping"

/**
 * GET /merchant/sales-channels
 * Returns the tenant's OWN sales channel(s). A pooled tenant has exactly one
 * sales channel (tenant.meta.sales_channel_id); we never expose other tenants'
 * channels.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ sales_channels: [] })

  const query = getQuery(req)
  const { data } = await query.graph({
    entity: "sales_channel",
    filters: { id: scId },
    fields: ["id", "name", "is_disabled"],
    pagination: { take: 1, skip: 0 } as any,
  })

  res.json({
    sales_channels: (data || []).map((sc: any) => ({
      id: sc.id,
      name: sc.name,
      is_disabled: !!sc.is_disabled,
    })),
  })
}
