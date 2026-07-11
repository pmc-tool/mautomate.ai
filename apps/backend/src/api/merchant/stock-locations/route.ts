import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const AddressSchema = z.object({
  address_1: z.string().min(1),
  address_2: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().min(2).max(2),
  postal_code: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
})

const CreateStockLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: AddressSchema.nullable().optional().default(null),
})

function formatAddress(address: any) {
  return address
    ? {
        address_1: address.address_1 ?? null,
        address_2: address.address_2 ?? null,
        city: address.city ?? null,
        country_code: address.country_code ?? null,
        postal_code: address.postal_code ?? null,
        province: address.province ?? null,
        phone: address.phone ?? null,
      }
    : null
}

function formatStockLocation(location: any) {
  return {
    id: location.id,
    name: location.name,
    address: formatAddress(location.address),
    created_at: location.created_at,
    updated_at: location.updated_at,
  }
}

/**
 * GET /merchant/stock-locations
 *
 * Stock locations are GLOBAL in Medusa, so rows are tagged with
 * metadata.tenant_id at creation and only this tenant's rows are returned.
 * Enriched with sales-channel names and fulfillment-set types so the list can
 * show connection + Pickup/Shipping status badges (Medusa-parity).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
      filters: { metadata: { tenant_id: ctx.tenant.id } },

    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "created_at",
      "updated_at",
      "address.*",
      "sales_channels.id",
      "sales_channels.name",
      "fulfillment_sets.id",
      "fulfillment_sets.type",
    ],
    pagination: { take: 500, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const locations = (data || []).filter(
    (l: any) => l.metadata?.tenant_id === ctx.tenant.id
  )

  res.json({
    stock_locations: locations.map((l: any) => ({
      ...formatStockLocation(l),
      sales_channels: (l.sales_channels || [])
        .filter(Boolean)
        .map((sc: any) => ({ id: sc.id, name: sc.name })),
      fulfillment_set_types: (l.fulfillment_sets || [])
        .filter(Boolean)
        .map((fs: any) => fs.type),
    })),
    count: locations.length,
  })
}

/**
 * POST /merchant/stock-locations
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateStockLocationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)

  try {
    const location = await stockLocationModule.createStockLocations({
      name: parsed.data.name,
      address: parsed.data.address
        ? {
            ...parsed.data.address,
            country_code: parsed.data.address.country_code.toUpperCase(),
          }
        : undefined,
      metadata: { tenant_id: ctx.tenant.id },
    })

    res.status(201).json({ stock_location: formatStockLocation(location) })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create stock location" })
  }
}
