import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const StatusSchema = z.enum(["draft", "active", "inactive"])
const TypeSchema = z.enum(["sale", "override"])

// The customer-group availability rule key mirrors Medusa admin exactly.
const CUSTOMER_GROUP_RULE = "customer.groups.id"

const CreatePriceListSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: TypeSchema.default("sale"),
  status: StatusSchema.default("draft"),
  starts_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
  customer_group_ids: z.array(z.string()).optional().default([]),
  prices: z
    .array(
      z.object({
        variant_id: z.string().min(1),
        amount: z.number().min(0),
        currency_code: z.string().min(3).max(3).default("usd"),
      })
    )
    .min(1),
})

function formatPriceList(priceList: any) {
  return {
    id: priceList.id,
    title: priceList.title,
    description: priceList.description ?? null,
    type: priceList.type ?? "sale",
    status: priceList.status,
    starts_at: priceList.starts_at ?? null,
    expires_at: priceList.ends_at ?? null,
    prices_count: priceList.prices?.length ?? 0,
    created_at: priceList.created_at,
    updated_at: priceList.updated_at,
  }
}

/**
 * Resolve a map of variant_id -> price_set_id for the given variants using the
 * product_variant_price_set link. Variants without a price set are returned in
 * `missing` so the caller can reject with a clear 400 instead of a 500.
 */
async function resolveVariantPriceSets(
  req: MedusaRequest,
  variantIds: string[]
): Promise<{ map: Record<string, string>; missing: string[] }> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_variant_price_set",
    filters: { variant_id: variantIds } as any,
    fields: ["variant_id", "price_set_id"],
  })
  const map: Record<string, string> = {}
  for (const link of links || []) {
    const l = link as any
    if (l.variant_id && l.price_set_id) map[l.variant_id] = l.price_set_id
  }
  const missing = variantIds.filter((id) => !map[id])
  return { map, missing }
}

/**
 * SECURITY INVARIANT (cross-tenant price write, P0): a merchant may only create
 * a price-list override for variants of products in THEIR OWN store — i.e. the
 * variant's product must be linked to this tenant's sales channel. Any variant
 * not owned by the caller's tenant makes the WHOLE request fail (no partial
 * apply). Mirrors the proven ownership pattern in orders/[id]/edit + gift-cards.
 */
async function findForeignVariants(
  req: MedusaRequest,
  scId: string | undefined,
  variantIds: string[]
): Promise<string[]> {
  if (!scId) return [...variantIds]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { id: variantIds } as any,
    fields: ["id", "product.sales_channels.id"],
    pagination: { take: variantIds.length, skip: 0 } as any,
  })
  const owned = new Set(
    (variants || [])
      .filter((v: any) =>
        (v.product?.sales_channels || []).some((sc: any) => sc.id === scId)
      )
      .map((v: any) => v.id)
  )
  return variantIds.filter((id) => !owned.has(id))
}

/**
 * Customer groups are global; a price list may only target THIS tenant's own
 * groups. Returns the ids that are not owned by the caller (fail-closed).
 */
export async function findForeignCustomerGroups(
  req: MedusaRequest,
  tenantId: string,
  groupIds: string[]
): Promise<string[]> {
  if (!groupIds.length) return []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer_group",
    filters: { id: groupIds } as any,
    fields: ["id", "metadata"],
    pagination: { take: groupIds.length, skip: 0 } as any,
  })
  const owned = new Set(
    (data || [])
      .filter((g: any) => g.metadata?.tenant_id === tenantId)
      .map((g: any) => g.id)
  )
  return groupIds.filter((id) => !owned.has(id))
}

/**
 * GET /merchant/price-lists
 *
 * Price lists are GLOBAL in Medusa, so rows are tagged with
 * metadata.tenant_id at creation and only this tenant's rows are returned.
 * Untagged rows (incl. pre-existing ones) are denied — fail-closed.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  const all = await pricingModule.listPriceLists(
    {},
    { take: 200, skip: 0, order: { created_at: "DESC" }, relations: ["prices"] }
  )
  const priceLists = (all || []).filter(
    (p: any) => p.metadata?.tenant_id === ctx.tenant.id
  )

  res.json({
    price_lists: priceLists.map(formatPriceList),
    count: priceLists.length,
  })
}

/**
 * POST /merchant/price-lists
 *
 * Creates a price list tagged with this tenant's id. Supports the Medusa model:
 * type (sale|override), customer-group availability (rules), and a flat price
 * grid (variant_id + currency + amount). Amounts are major units.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreatePriceListSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const data = parsed.data
  const variantIds = data.prices.map((p) => p.variant_id)

  // Reject before touching price sets if ANY variant is not owned by this
  // tenant's store. 404 so a foreign/unknown variant is indistinguishable.
  const foreign = await findForeignVariants(
    req,
    ctx.tenant.meta?.sales_channel_id,
    variantIds
  )
  if (foreign.length) {
    return res.status(404).json({ message: `variant not found: ${foreign.join(", ")}` })
  }

  // Reject foreign customer groups the same way.
  if (data.customer_group_ids.length) {
    const foreignGroups = await findForeignCustomerGroups(
      req,
      ctx.tenant.id,
      data.customer_group_ids
    )
    if (foreignGroups.length) {
      return res.status(404).json({
        message: `customer group not found: ${foreignGroups.join(", ")}`,
      })
    }
  }

  const { map, missing } = await resolveVariantPriceSets(req, variantIds)
  if (missing.length) {
    return res.status(400).json({
      message: `no price set exists for variants: ${missing.join(", ")}`,
    })
  }

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  try {
    const [priceList] = await pricingModule.createPriceLists([
      {
        title: data.title,
        description: data.description ?? data.title,
        type: data.type,
        status: data.status,
        starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : undefined,
        ends_at: data.expires_at ? new Date(data.expires_at).toISOString() : undefined,
        prices: data.prices.map((p) => ({
          amount: p.amount,
          currency_code: p.currency_code,
          price_set_id: map[p.variant_id],
        })),
        metadata: { tenant_id: ctx.tenant.id },
      },
    ])

    // Customer-group availability. setPriceListRules replaces the rule set, so
    // we only call it when groups were chosen.
    if (data.customer_group_ids.length) {
      await pricingModule.setPriceListRules({
        price_list_id: priceList.id,
        rules: { [CUSTOMER_GROUP_RULE]: data.customer_group_ids },
      })
    }

    res.status(201).json({ price_list: formatPriceList(priceList) })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create price list" })
  }
}
