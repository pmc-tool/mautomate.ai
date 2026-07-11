import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const StatusSchema = z.enum(["draft", "active", "inactive"])

const CreatePriceListSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: StatusSchema.default("draft"),
  starts_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
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
 * Creates a price list tagged with this tenant's id. Each price must reference
 * a variant_id whose price set is resolved to the price_set_id the pricing
 * module expects.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreatePriceListSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const variantIds = parsed.data.prices.map((p) => p.variant_id)
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
        title: parsed.data.title,
        description: parsed.data.description ?? parsed.data.title,
        status: parsed.data.status,
        starts_at: parsed.data.starts_at
          ? new Date(parsed.data.starts_at).toISOString()
          : undefined,
        ends_at: parsed.data.expires_at
          ? new Date(parsed.data.expires_at).toISOString()
          : undefined,
        prices: parsed.data.prices.map((p) => ({
          amount: p.amount,
          currency_code: p.currency_code,
          price_set_id: map[p.variant_id],
        })),
        metadata: { tenant_id: ctx.tenant.id },
      },
    ])

    res.status(201).json({ price_list: formatPriceList(priceList) })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create price list" })
  }
}
