import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  updateServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { getOrCreateDefaultLocation } from "../../_inventory"
import {
  getQuery,
  ensureProviderLinked,
  defaultProfileId,
  tenantCurrency,
  MANUAL_PROVIDER,
} from "../../_shipping"

/**
 * POST /merchant/setup/delivery
 *
 * The setup wizard's one-call "quick delivery" — turns the merchant's answer
 * ("I deliver to these countries, this is what I charge") into a working,
 * store-enabled shipping option a shopper can actually pick at checkout. It
 * composes the four-level fulfillment hierarchy the platform already exposes
 * piecemeal (location -> shipping fulfillment set -> service zone -> shipping
 * option) into a single idempotent step so a non-technical merchant never has
 * to understand any of it.
 *
 * Idempotent:
 *   - reuses the tenant's stock location and shipping fulfillment set;
 *   - unions the requested countries into the existing service zone (or creates
 *     one);
 *   - only creates a delivery option if the zone has none, so calling it twice
 *     doesn't pile up duplicates.
 *
 * Everything is tenant-scoped through the owning stock location.
 */

const Schema = z.object({
  countries: z.array(z.string().length(2)).min(1).max(50),
  price_type: z.enum(["free", "flat"]).default("free"),
  amount: z.number().min(0).optional(),
  name: z.string().min(1).max(120).optional(),
})

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "delivery"
}

async function loadShippingSet(query: any, locationId: string) {
  const { data } = await query.graph({
    entity: "stock_location",
    filters: { id: locationId } as any,
    fields: [
      "id",
      "fulfillment_sets.id",
      "fulfillment_sets.type",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.geo_zones.country_code",
      "fulfillment_sets.service_zones.shipping_options.id",
    ],
  })
  const loc = data?.[0]
  const sets: any[] = loc?.fulfillment_sets || []
  const shippingSet = sets.find((s) => s.type === "shipping") || sets[0] || null
  return shippingSet
}

/**
 * The outbound (non-return) shipping option already configured on a zone, if
 * any. We reconcile this one to the merchant's requested price instead of
 * blindly creating a second option.
 */
async function outboundOption(query: any, zoneId: string) {
  const { data } = await query.graph({
    entity: "service_zone",
    filters: { id: zoneId } as any,
    fields: [
      "id",
      "shipping_options.id",
      "shipping_options.name",
      "shipping_options.rules.attribute",
      "shipping_options.rules.value",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })
  const opts = data?.[0]?.shipping_options || []
  const isReturn = (o: any) =>
    (o.rules || []).some(
      (r: any) =>
        r.attribute === "is_return" && (r.value === "true" || r.value === true)
    )
  return opts.find((o: any) => !isReturn(o)) || opts[0] || null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const body = parsed.data
  const countries = body.countries.map((c) => c.toLowerCase())

  const query = getQuery(req)

  try {
    // 1. location
    const locationId = await getOrCreateDefaultLocation(req, ctx)
    if (!locationId) {
      return res.status(400).json({ message: "could not resolve a stock location" })
    }
    await ensureProviderLinked(req, query, locationId)

    // 2. shipping fulfillment set (create if missing, then re-read for its id)
    let shippingSet = await loadShippingSet(query, locationId)
    if (!shippingSet) {
      // The fulfillment-set NAME carries a GLOBAL unique index (same as the
      // service_zone name), so two stores that happen to share a display name
      // (e.g. several "Larkley Derrick Williams" tenants) collide with
      // "Fulfillment set with name ... already exists" and delivery can never be
      // set up. Isolation is by the tenant's OWN stock location (loadShippingSet
      // filters by it), so the name only needs to be globally unique: namespace
      // it by the tenant slug (unique per tenant), staying human-readable.
      await createLocationFulfillmentSetWorkflow(req.scope).run({
        input: {
          location_id: locationId,
          fulfillment_set_data: {
            name: `${ctx.tenant.name || "Store"} shipping (${ctx.tenant.slug})`,
            type: "shipping",
          },
        },
      })
      shippingSet = await loadShippingSet(query, locationId)
    }
    if (!shippingSet?.id) {
      return res.status(400).json({ message: "could not create a fulfillment set" })
    }

    // 3. service zone — union the requested countries into an existing zone, or
    //    create one covering them.
    const zones: any[] = shippingSet.service_zones || []
    let zone = zones[0] || null
    if (zone) {
      const existing = new Set(
        (zone.geo_zones || [])
          .map((g: any) => String(g.country_code || "").toLowerCase())
          .filter(Boolean)
      )
      countries.forEach((c) => existing.add(c))
      const merged = Array.from(existing)
      await updateServiceZonesWorkflow(req.scope).run({
        input: {
          selector: { id: zone.id },
          update: {
            geo_zones: merged.map((c) => ({ type: "country" as const, country_code: c })),
          },
        },
      })
    } else {
      // Service-zone names carry a GLOBAL unique index in the pooled backend, so
      // a plain "Delivery" collides the moment a second store sets up delivery.
      // Namespace the name by the tenant slug (unique per tenant) — it stays
      // readable and never collides.
      await createServiceZonesWorkflow(req.scope).run({
        input: {
          data: [
            {
              fulfillment_set_id: shippingSet.id,
              name: `Delivery (${ctx.tenant.slug})`,
              geo_zones: countries.map((c) => ({
                type: "country" as const,
                country_code: c,
              })),
            },
          ],
        },
      })
    }

    // Re-read to get the concrete zone id + whether it already has options.
    shippingSet = await loadShippingSet(query, locationId)
    zone = (shippingSet?.service_zones || [])[0] || null
    if (!zone?.id) {
      return res.status(400).json({ message: "could not create a delivery zone" })
    }

    // 4. store-enabled delivery option. Create one if the zone has none yet;
    //    otherwise RECONCILE the existing option to the requested price/type/
    //    name. Previously the existing option was kept untouched, so a zone that
    //    already had a "Free Delivery" option silently ignored a later
    //    "Flat $15" submission and it saved as free.
    const profileId = await defaultProfileId(query)
    if (!profileId) {
      return res.status(400).json({ message: "no shipping profile available" })
    }
    const currency = await tenantCurrency(query, ctx.tenant)
    const isFree = body.price_type === "free"
    const name = body.name || (isFree ? "Free Delivery" : "Standard Delivery")
    // Medusa shipping options are "flat" or "calculated" — there is no "free"
    // price type. Free delivery is simply a flat rate of zero.
    const amount = isFree ? 0 : Math.round(body.amount ?? 0)

    const existingOption = await outboundOption(query, zone.id)
    let shippingOptionId: string | null = existingOption?.id ?? null

    if (!shippingOptionId) {
      const { result } = await createShippingOptionsWorkflow(req.scope).run({
        input: [
          {
            name,
            service_zone_id: zone.id,
            shipping_profile_id: profileId,
            provider_id: MANUAL_PROVIDER,
            price_type: "flat",
            type: { label: name, code: slugify(name), description: name },
            prices: [{ currency_code: currency, amount }],
            data: { id: "manual-fulfillment" },
            rules: [
              { attribute: "is_return", operator: "eq", value: "false" },
              { attribute: "enabled_in_store", operator: "eq", value: "true" },
            ],
          },
        ],
      })
      shippingOptionId = (result as any)?.[0]?.id ?? null
    } else {
      // Replace the flat price and keep the option's store visibility rules.
      await updateShippingOptionsWorkflow(req.scope).run({
        input: [
          {
            id: shippingOptionId,
            name,
            price_type: "flat",
            prices: [{ currency_code: currency, amount }],
          },
        ],
      })
    }

    res.status(201).json({
      success: true,
      location_id: locationId,
      service_zone_id: zone.id,
      shipping_option_id: shippingOptionId,
      countries: (zone.geo_zones || [])
        .map((g: any) => String(g.country_code || "").toLowerCase())
        .filter(Boolean),
    })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to set up delivery" })
  }
}
