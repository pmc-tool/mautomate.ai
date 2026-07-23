import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const StatusSchema = z.enum(["draft", "active", "inactive"])
const TypeSchema = z.enum(["sale", "override"])
const CUSTOMER_GROUP_RULE = "customer.groups.id"

const UpdatePriceListSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: TypeSchema.optional(),
  status: StatusSchema.optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  customer_group_ids: z.array(z.string()).optional(),
  prices: z
    .array(
      z.object({
        variant_id: z.string().min(1),
        amount: z.number().min(0),
        currency_code: z.string().min(3).max(3).default("usd"),
      })
    )
    .optional(),
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

function getQuery(req: MedusaRequest) {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY)
}

async function findForeignVariants(
  req: MedusaRequest,
  scId: string | undefined,
  variantIds: string[]
): Promise<string[]> {
  if (!scId) return [...variantIds]
  const query = getQuery(req)
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

async function findForeignCustomerGroups(
  req: MedusaRequest,
  tenantId: string,
  groupIds: string[]
): Promise<string[]> {
  if (!groupIds.length) return []
  const query = getQuery(req)
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

async function resolveVariantPriceSets(
  req: MedusaRequest,
  variantIds: string[]
): Promise<{ map: Record<string, string>; missing: string[] }> {
  const query = getQuery(req)
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

async function loadOwned(
  req: MedusaRequest,
  tenantId: string,
  id: string,
  relations: string[]
) {
  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  const pl = await pricingModule
    .retrievePriceList(id, { relations })
    .catch(() => null)
  if (!pl || pl.metadata?.tenant_id !== tenantId) return null
  return pl
}

function extractCustomerGroupIds(rules: any[]): string[] {
  for (const r of rules || []) {
    if (r?.attribute !== CUSTOMER_GROUP_RULE) continue
    const val = r.value
    if (Array.isArray(val)) return val.map((v: any) => (typeof v === "string" ? v : v?.id)).filter(Boolean)
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed
      } catch {
        return [val]
      }
    }
  }
  return []
}

/**
 * GET /merchant/price-lists/:id
 * Full detail for the edit wizard: type, status, dates, customer groups, and
 * each override price resolved back to its product/variant.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const pl = await loadOwned(req, ctx.tenant.id, id, ["prices", "price_list_rules"])
  if (!pl) return res.status(404).json({ message: "price list not found" })

  // Resolve each price's price_set_id back to a variant + product.
  const priceSetIds = Array.from(
    new Set((pl.prices || []).map((p: any) => p.price_set_id).filter(Boolean))
  )
  const psToVariant: Record<string, any> = {}
  if (priceSetIds.length) {
    const query = getQuery(req)
    const { data: links } = await query.graph({
      entity: "product_variant_price_set",
      filters: { price_set_id: priceSetIds } as any,
      fields: ["price_set_id", "variant_id"],
    })
    // Nested variant/product titles do not resolve through the link entity, so
    // resolve them in a second pass from product_variant directly.
    const variantIds = Array.from(
      new Set((links || []).map((l: any) => l.variant_id).filter(Boolean))
    )
    const vInfo: Record<string, any> = {}
    if (variantIds.length) {
      const { data: vs } = await query.graph({
        entity: "product_variant",
        filters: { id: variantIds } as any,
        fields: ["id", "title", "product.id", "product.title"],
        pagination: { take: variantIds.length, skip: 0 } as any,
      })
      for (const v of vs || []) {
        const vv = v as any
        vInfo[vv.id] = {
          variant_title: vv.title ?? null,
          product_id: vv.product?.id ?? null,
          product_title: vv.product?.title ?? null,
        }
      }
    }
    for (const l of links || []) {
      const link = l as any
      const info = vInfo[link.variant_id] || {}
      psToVariant[link.price_set_id] = {
        variant_id: link.variant_id,
        variant_title: info.variant_title ?? null,
        product_id: info.product_id ?? null,
        product_title: info.product_title ?? null,
      }
    }
  }

  const prices = (pl.prices || []).map((p: any) => {
    const v = psToVariant[p.price_set_id] || {}
    return {
      id: p.id,
      amount: Number(p.amount ?? 0),
      currency_code: p.currency_code,
      variant_id: v.variant_id ?? null,
      variant_title: v.variant_title ?? null,
      product_id: v.product_id ?? null,
      product_title: v.product_title ?? null,
    }
  })

  res.json({
    price_list: {
      id: pl.id,
      title: pl.title,
      description: pl.description ?? null,
      type: pl.type ?? "sale",
      status: pl.status,
      starts_at: pl.starts_at ?? null,
      expires_at: pl.ends_at ?? null,
      customer_group_ids: extractCustomerGroupIds(pl.price_list_rules),
      prices,
    },
  })
}

/**
 * PUT /merchant/price-lists/:id
 * Edits details (type/title/status/description/dates), customer-group
 * availability (rules), and the override price grid. `prices`, when sent, is the
 * FULL desired set — the route diffs it against the stored prices and issues the
 * needed create / update / delete against the pricing module.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parsed = UpdatePriceListSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const data = parsed.data

  const existing = await loadOwned(req, ctx.tenant.id, id, ["prices"])
  if (!existing) return res.status(404).json({ message: "price list not found" })

  const pricingModule: any = req.scope.resolve(Modules.PRICING)

  try {
    // 1. Details
    const update: any = { id }
    if (data.title !== undefined) update.title = data.title
    if (data.description !== undefined) update.description = data.description
    if (data.type !== undefined) update.type = data.type
    if (data.status !== undefined) update.status = data.status
    if (data.starts_at !== undefined) {
      update.starts_at = data.starts_at ? new Date(data.starts_at).toISOString() : null
    }
    if (data.expires_at !== undefined) {
      update.ends_at = data.expires_at ? new Date(data.expires_at).toISOString() : null
    }
    await pricingModule.updatePriceLists([update])

    // 2. Customer-group availability
    if (data.customer_group_ids !== undefined) {
      const ids = data.customer_group_ids
      if (ids.length) {
        const foreignGroups = await findForeignCustomerGroups(req, ctx.tenant.id, ids)
        if (foreignGroups.length) {
          return res.status(404).json({
            message: `customer group not found: ${foreignGroups.join(", ")}`,
          })
        }
        await pricingModule.setPriceListRules({
          price_list_id: id,
          rules: { [CUSTOMER_GROUP_RULE]: ids },
        })
      } else {
        await pricingModule
          .removePriceListRules({ price_list_id: id, rules: [CUSTOMER_GROUP_RULE] })
          .catch(() => {})
      }
    }

    // 3. Prices — diff the full desired set against what is stored.
    if (data.prices !== undefined) {
      const variantIds = Array.from(new Set(data.prices.map((p) => p.variant_id)))

      const foreign = await findForeignVariants(
        req,
        ctx.tenant.meta?.sales_channel_id,
        variantIds
      )
      if (foreign.length) {
        return res.status(404).json({ message: `variant not found: ${foreign.join(", ")}` })
      }

      const { map, missing } = await resolveVariantPriceSets(req, variantIds)
      if (missing.length) {
        return res.status(400).json({
          message: `no price set exists for variants: ${missing.join(", ")}`,
        })
      }

      const existKey = new Map<string, { id: string; amount: number }>()
      for (const ep of existing.prices || []) {
        existKey.set(`${ep.price_set_id}:${ep.currency_code}`, {
          id: ep.id,
          amount: Number(ep.amount),
        })
      }

      const creates: any[] = []
      const updates: any[] = []
      const keepKeys = new Set<string>()

      for (const p of data.prices) {
        const ps = map[p.variant_id]
        const key = `${ps}:${p.currency_code}`
        keepKeys.add(key)
        const ex = existKey.get(key)
        if (ex) {
          if (Number(ex.amount) !== Number(p.amount)) {
            updates.push({
              id: ex.id,
              amount: p.amount,
              currency_code: p.currency_code,
              price_set_id: ps,
            })
          }
        } else {
          creates.push({
            amount: p.amount,
            currency_code: p.currency_code,
            price_set_id: ps,
          })
        }
      }

      const deleteIds: string[] = []
      for (const [key, ex] of existKey) {
        if (!keepKeys.has(key)) deleteIds.push(ex.id)
      }

      if (creates.length) {
        await pricingModule.addPriceListPrices([{ price_list_id: id, prices: creates }])
      }
      if (updates.length) {
        await pricingModule.updatePriceListPrices([{ price_list_id: id, prices: updates }])
      }
      if (deleteIds.length) {
        await pricingModule.removePrices(deleteIds)
      }
    }

    const fresh = await pricingModule.retrievePriceList(id, { relations: ["prices"] })
    res.json({ price_list: formatPriceList(fresh) })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update price list" })
  }
}

/**
 * DELETE /merchant/price-lists/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await loadOwned(req, ctx.tenant.id, id, [])
  if (!existing) return res.status(404).json({ message: "price list not found" })

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  await pricingModule.deletePriceLists([id])
  res.status(204).send()
}
