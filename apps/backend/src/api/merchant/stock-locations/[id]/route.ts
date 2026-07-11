import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateStockLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z
    .object({
      address_1: z.string().min(1),
      address_2: z.string().optional(),
      city: z.string().optional(),
      country_code: z.string().min(2).max(2),
      postal_code: z.string().optional(),
      province: z.string().optional(),
      phone: z.string().optional(),
    })
    .nullable()
    .optional(),
})

function formatStockLocation(location: any) {
  const address = location.address || null
  return {
    id: location.id,
    name: location.name,
    address: address
      ? {
          address_1: address.address_1 ?? null,
          address_2: address.address_2 ?? null,
          city: address.city ?? null,
          country_code: address.country_code ?? null,
          postal_code: address.postal_code ?? null,
          province: address.province ?? null,
          phone: address.phone ?? null,
        }
      : null,
    created_at: location.created_at,
    updated_at: location.updated_at,
  }
}

async function findOwnedLocation(req: MedusaRequest, tenantId: string, id: string) {
  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)
  const [location] = await stockLocationModule.listStockLocations(
    { id },
    { take: 1, relations: ["address"] }
  )
  if (!location || location.metadata?.tenant_id !== tenantId) return null
  return location
}

// Reads a rule value off a shipping option's rules array (attribute -> boolean).
function ruleFlag(rules: any[], attribute: string): boolean {
  const r = (rules || []).find((x) => x?.attribute === attribute)
  if (!r) return false
  const v = r.value
  return v === true || v === "true"
}

function mapShippingOption(so: any) {
  const rules = so.rules || []
  return {
    id: so.id,
    name: so.name,
    price_type: so.price_type,
    provider_id: so.provider?.id ?? so.provider_id ?? null,
    is_return: ruleFlag(rules, "is_return"),
    enabled_in_store: ruleFlag(rules, "enabled_in_store"),
    shipping_profile: so.shipping_profile
      ? { id: so.shipping_profile.id, name: so.shipping_profile.name }
      : null,
    type: so.type
      ? { id: so.type.id, label: so.type.label, code: so.type.code }
      : null,
    prices: (so.prices || [])
      .filter(Boolean)
      .map((p: any) => ({
        amount: Number(p.amount ?? 0),
        currency_code: p.currency_code ?? null,
      })),
  }
}

function mapServiceZone(z: any) {
  return {
    id: z.id,
    name: z.name,
    geo_zones: (z.geo_zones || []).filter(Boolean).map((g: any) => ({
      id: g.id,
      type: g.type,
      country_code: g.country_code ?? null,
      province_code: g.province_code ?? null,
    })),
    shipping_options: (z.shipping_options || []).filter(Boolean).map(mapShippingOption),
  }
}

function mapEnrichedLocation(loc: any) {
  return {
    id: loc.id,
    name: loc.name,
    metadata: loc.metadata ?? null,
    address: loc.address
      ? {
          address_1: loc.address.address_1 ?? null,
          address_2: loc.address.address_2 ?? null,
          city: loc.address.city ?? null,
          country_code: loc.address.country_code ?? null,
          postal_code: loc.address.postal_code ?? null,
          province: loc.address.province ?? null,
          phone: loc.address.phone ?? null,
          company: loc.address.company ?? null,
        }
      : null,
    sales_channels: (loc.sales_channels || [])
      .filter(Boolean)
      .map((sc: any) => ({ id: sc.id, name: sc.name })),
    fulfillment_providers: (loc.fulfillment_providers || [])
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, is_enabled: p.is_enabled !== false })),
    fulfillment_sets: (loc.fulfillment_sets || []).filter(Boolean).map((fs: any) => ({
      id: fs.id,
      name: fs.name,
      type: fs.type,
      service_zones: (fs.service_zones || []).filter(Boolean).map(mapServiceZone),
    })),
    created_at: loc.created_at,
    updated_at: loc.updated_at,
  }
}

/**
 * GET /merchant/stock-locations/:id
 *
 * Full location + shipping hierarchy (fulfillment sets -> service zones ->
 * geo zones + shipping options with profile/provider/type/rules/prices, plus
 * connected sales channels and fulfillment providers). Tenant-scoped: the
 * location must carry this tenant's metadata.tenant_id or it 404s.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "stock_location",
    filters: { id } as any,
    fields: [
      "id",
      "name",
      "metadata",
      "created_at",
      "updated_at",
      "address.*",
      "sales_channels.id",
      "sales_channels.name",
      "fulfillment_providers.id",
      "fulfillment_providers.is_enabled",
      "fulfillment_sets.id",
      "fulfillment_sets.name",
      "fulfillment_sets.type",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.name",
      "fulfillment_sets.service_zones.geo_zones.id",
      "fulfillment_sets.service_zones.geo_zones.type",
      "fulfillment_sets.service_zones.geo_zones.country_code",
      "fulfillment_sets.service_zones.geo_zones.province_code",
      "fulfillment_sets.service_zones.shipping_options.id",
      "fulfillment_sets.service_zones.shipping_options.name",
      "fulfillment_sets.service_zones.shipping_options.price_type",
      "fulfillment_sets.service_zones.shipping_options.provider.id",
      "fulfillment_sets.service_zones.shipping_options.shipping_profile.id",
      "fulfillment_sets.service_zones.shipping_options.shipping_profile.name",
      "fulfillment_sets.service_zones.shipping_options.type.id",
      "fulfillment_sets.service_zones.shipping_options.type.label",
      "fulfillment_sets.service_zones.shipping_options.type.code",
      "fulfillment_sets.service_zones.shipping_options.rules.attribute",
      "fulfillment_sets.service_zones.shipping_options.rules.operator",
      "fulfillment_sets.service_zones.shipping_options.rules.value",
      "fulfillment_sets.service_zones.shipping_options.prices.amount",
      "fulfillment_sets.service_zones.shipping_options.prices.currency_code",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const loc: any = (data || [])[0]
  if (!loc || loc.metadata?.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({ message: "stock location not found" })
  }

  res.json({ stock_location: mapEnrichedLocation(loc) })
}

/**
 * PUT /merchant/stock-locations/:id
 *
 * Only locations tagged with this tenant's metadata.tenant_id can be
 * updated — other tenants' rows return 404.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const location = await findOwnedLocation(req, ctx.tenant.id, id)
  if (!location) return res.status(404).json({ message: "stock location not found" })

  const parsed = UpdateStockLocationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)
  const updated = await stockLocationModule.updateStockLocations(id, {
    name: parsed.data.name ?? undefined,
    address: parsed.data.address
      ? {
          ...parsed.data.address,
          country_code: parsed.data.address.country_code.toUpperCase(),
        }
      : undefined,
  })

  res.json({ stock_location: formatStockLocation(updated) })
}

/**
 * DELETE /merchant/stock-locations/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const location = await findOwnedLocation(req, ctx.tenant.id, id)
  if (!location) return res.status(404).json({ message: "stock location not found" })

  const stockLocationModule: any = req.scope.resolve(Modules.STOCK_LOCATION)
  await stockLocationModule.deleteStockLocations(id)

  res.json({ id, object: "stock_location", deleted: true })
}
