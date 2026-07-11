import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createShippingOptionsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import {
  getQuery,
  zoneOwner,
  ensureProviderLinked,
  defaultProfileId,
  tenantCurrency,
  MANUAL_PROVIDER,
} from "../_shipping"

const Schema = z.object({
  service_zone_id: z.string().min(1),
  name: z.string().min(1).max(200),
  price_type: z.enum(["flat", "calculated"]).default("flat"),
  is_return: z.boolean().default(false),
  enabled_in_store: z.boolean().default(true),
  amount: z.number().nonnegative().optional(),
})

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "standard"
  )
}

/**
 * POST /merchant/shipping-options
 * Create a shipping option in a service zone. Provider + shipping profile are
 * resolved automatically (single manual provider, default profile). Flat price
 * uses the store currency. is_return / enabled_in_store are stored as rules.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const body = parsed.data

  const query = getQuery(req)
  const { tenantId, locationId } = await zoneOwner(query, body.service_zone_id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "service zone not found" })
  }

  const profileId = await defaultProfileId(query)
  if (!profileId) {
    return res.status(400).json({ message: "no shipping profile available" })
  }
  const currency = await tenantCurrency(query, ctx.tenant)

  const prices =
    body.price_type === "flat"
      ? [{ currency_code: currency, amount: Math.round(body.amount ?? 0) }]
      : []

  try {
    if (locationId) await ensureProviderLinked(req, query, locationId)

    const { result } = await createShippingOptionsWorkflow(req.scope).run({
      input: [
        {
          name: body.name,
          service_zone_id: body.service_zone_id,
          shipping_profile_id: profileId,
          provider_id: MANUAL_PROVIDER,
          price_type: body.price_type,
          type: { label: body.name, code: slugify(body.name), description: body.name },
          prices,
          data: { id: body.is_return ? "manual-fulfillment-return" : "manual-fulfillment" },
          rules: [
            { attribute: "is_return", operator: "eq", value: body.is_return ? "true" : "false" },
            {
              attribute: "enabled_in_store",
              operator: "eq",
              value: body.enabled_in_store ? "true" : "false",
            },
          ],
        },
      ],
    })
    res.status(201).json({ shipping_option: { id: (result as any)?.[0]?.id } })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create shipping option" })
  }
}
