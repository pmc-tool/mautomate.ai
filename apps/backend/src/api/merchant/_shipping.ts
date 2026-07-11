import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { batchLinksWorkflow } from "@medusajs/core-flows"

/**
 * Shared helpers for the merchant locations & shipping routes.
 *
 * Isolation model: fulfillment sets, service zones and shipping options are
 * GLOBAL fulfillment-module rows, but each one hangs off a stock location that
 * carries metadata.tenant_id. Every write walks the chain up to the owning
 * location and checks the tenant id, so a merchant can only ever touch their
 * own shipping configuration.
 */

export const MANUAL_PROVIDER = "manual_manual"

export function getQuery(req: MedusaRequest) {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY)
}

export async function locationTenantId(query: any, locationId: string): Promise<string | null> {
  const { data } = await query.graph({
    entity: "stock_location",
    filters: { id: locationId },
    fields: ["id", "metadata"],
    pagination: { take: 1, skip: 0 },
  })
  return data?.[0]?.metadata?.tenant_id ?? null
}

export async function setOwner(
  query: any,
  setId: string
): Promise<{ tenantId: string | null; locationId: string | null; type: string | null }> {
  const { data } = await query.graph({
    entity: "fulfillment_set",
    filters: { id: setId },
    fields: ["id", "type", "location.id", "location.metadata"],
    pagination: { take: 1, skip: 0 },
  })
  const row = data?.[0]
  return {
    tenantId: row?.location?.metadata?.tenant_id ?? null,
    locationId: row?.location?.id ?? null,
    type: row?.type ?? null,
  }
}

export async function zoneOwner(
  query: any,
  zoneId: string
): Promise<{ tenantId: string | null; locationId: string | null }> {
  const { data } = await query.graph({
    entity: "service_zone",
    filters: { id: zoneId },
    fields: ["id", "fulfillment_set.location.id", "fulfillment_set.location.metadata"],
    pagination: { take: 1, skip: 0 },
  })
  const loc = data?.[0]?.fulfillment_set?.location
  return { tenantId: loc?.metadata?.tenant_id ?? null, locationId: loc?.id ?? null }
}

export async function optionOwner(
  query: any,
  optionId: string
): Promise<{ tenantId: string | null; locationId: string | null }> {
  const { data } = await query.graph({
    entity: "shipping_option",
    filters: { id: optionId },
    fields: [
      "id",
      "service_zone.fulfillment_set.location.id",
      "service_zone.fulfillment_set.location.metadata",
    ],
    pagination: { take: 1, skip: 0 },
  })
  const loc = data?.[0]?.service_zone?.fulfillment_set?.location
  return { tenantId: loc?.metadata?.tenant_id ?? null, locationId: loc?.id ?? null }
}

/**
 * Ensure the manual fulfillment provider is linked to a location. Shipping
 * options cannot be created until a provider is enabled for the location, and
 * there is exactly one provider available, so we link it transparently.
 */
export async function ensureProviderLinked(
  req: MedusaRequest,
  query: any,
  locationId: string
): Promise<void> {
  // Check the link from the stock_location side — fulfillment_provider is not
  // filterable by stock_location_id in this Medusa version.
  const { data } = await query.graph({
    entity: "stock_location",
    filters: { id: locationId },
    fields: ["id", "fulfillment_providers.id"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const already = (data?.[0]?.fulfillment_providers || []).some(
    (p: any) => p.id === MANUAL_PROVIDER
  )
  if (already) return
  await batchLinksWorkflow(req.scope).run({
    input: {
      create: [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: MANUAL_PROVIDER },
        },
      ],
      delete: [],
    },
  })
}

export async function defaultProfileId(query: any): Promise<string | null> {
  const { data } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "type"],
    pagination: { take: 20, skip: 0 },
  })
  const def = (data || []).find((p: any) => p.type === "default") || (data || [])[0]
  return def?.id ?? null
}

export async function tenantCurrency(query: any, tenant: any): Promise<string> {
  const regionId = tenant?.meta?.region_id
  if (!regionId) return "usd"
  try {
    const { data } = await query.graph({
      entity: "region",
      filters: { id: regionId },
      fields: ["id", "currency_code"],
      pagination: { take: 1, skip: 0 },
    })
    return data?.[0]?.currency_code || "usd"
  } catch {
    return "usd"
  }
}
