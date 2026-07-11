import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const productStatuses = ["draft", "published", "proposed", "rejected"] as const

const CreateGiftCardSchema = z.object({
  title: z.string().min(1),
  handle: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(productStatuses).default("draft"),
  prices: z.array(z.object({
    amount: z.number().min(0),
    currency_code: z.string().min(3).max(3).default("usd"),
  })).min(1),
  sku: z.string().optional(),
  thumbnail: z.string().optional(),
})

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

function formatGiftCard(product: any) {
  const variant = (product.variants || [])[0]
  const price = (variant?.prices || [])[0]
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: product.status,
    thumbnail: product.thumbnail,
    price: price?.amount ?? null,
    currency_code: price?.currency_code ?? null,
    sku: variant?.sku ?? null,
    created_at: product.created_at,
    updated_at: product.updated_at,
  }
}

/**
 * GET /merchant/gift-cards
 *
 * Gift cards ARE products, so they are scoped to the tenant's sales channel:
 * only gift-card products linked to ctx.tenant.meta.sales_channel_id are
 * returned. Pre-existing gift cards not linked to this channel are invisible.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ gift_cards: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return res.json({ gift_cards: [], count: 0 })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const products = await productModule.listProducts(
    { id: ids, is_giftcard: true },
    { take: 200, skip: 0, order: { created_at: "DESC" }, relations: ["variants.prices"] }
  )

  res.json({
    gift_cards: (products || []).map(formatGiftCard),
    count: products?.length ?? 0,
  })
}

/**
 * POST /merchant/gift-cards
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const parsed = CreateGiftCardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { title, handle, description, status, prices, sku, thumbnail } = parsed.data

  const { result: products } = await createProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          title,
          handle: handle || slugify(title),
          description,
          status,
          is_giftcard: true,
          thumbnail,
          sales_channels: [{ id: scId }],
          options: [{ title: "Default", values: ["Default"] }],
          variants: [
            {
              title: "Default",
              sku,
              prices,
              options: { Default: "Default" },
              manage_inventory: false,
            },
          ],
        },
      ],
    },
  })

  const product = (products as any[])[0]
  res.status(201).json({ gift_card: formatGiftCard(product) })
}
