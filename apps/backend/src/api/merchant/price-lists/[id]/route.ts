import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const StatusSchema = z.enum(["draft", "active", "inactive"])

const UpdatePriceListSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: StatusSchema.optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
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
 * Load a price list only if it is tagged with this tenant's
 * metadata.tenant_id. Untagged / foreign rows resolve to null (fail-closed).
 */
async function findOwnedPriceList(
  req: MedusaRequest,
  tenantId: string,
  id: string,
  relations?: string[]
) {
  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  const priceList = await pricingModule
    .retrievePriceList(id, relations ? { relations } : undefined)
    .catch(() => null)
  if (!priceList || priceList.metadata?.tenant_id !== tenantId) return null
  return priceList
}

/**
 * GET /merchant/price-lists/:id
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const priceList = await findOwnedPriceList(req, ctx.tenant.id, id, ["prices"])
  if (!priceList) return res.status(404).json({ message: "price list not found" })

  res.json({ price_list: formatPriceList(priceList) })
}

/**
 * PUT /merchant/price-lists/:id
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parsed = UpdatePriceListSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const existing = await findOwnedPriceList(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "price list not found" })

  const update: any = { id }
  if (parsed.data.title !== undefined) update.title = parsed.data.title
  if (parsed.data.description !== undefined) update.description = parsed.data.description
  if (parsed.data.status !== undefined) update.status = parsed.data.status
  if (parsed.data.starts_at !== undefined) {
    update.starts_at = parsed.data.starts_at ? new Date(parsed.data.starts_at).toISOString() : null
  }
  if (parsed.data.expires_at !== undefined) {
    update.ends_at = parsed.data.expires_at ? new Date(parsed.data.expires_at).toISOString() : null
  }

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  const [priceList] = await pricingModule.updatePriceLists([update])
  res.json({ price_list: formatPriceList(priceList) })
}

/**
 * DELETE /merchant/price-lists/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await findOwnedPriceList(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "price list not found" })

  const pricingModule: any = req.scope.resolve(Modules.PRICING)
  await pricingModule.deletePriceLists([id])
  res.status(204).send()
}
