import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { namespaceCode, denamespaceCode } from "../_promo-code"

const DiscountTypeSchema = z.enum(["percentage", "fixed", "free_shipping"])
const StatusSchema = z.enum(["draft", "active", "inactive"])

const UpdateDiscountSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  type: DiscountTypeSchema.optional(),
  status: StatusSchema.optional(),
  value: z.number().int().min(0).optional(),
  currency_code: z.string().min(3).max(3).optional(),
  target_type: z.enum(["order", "items", "shipping_methods"]).optional(),
  usage_limit: z.number().int().min(0).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  is_automatic: z.boolean().optional(),
})

function buildApplicationMethod(data: z.infer<typeof UpdateDiscountSchema>) {
  const type = data.type === "free_shipping" ? "percentage" : data.type
  const target_type = data.type === "free_shipping" ? "shipping_methods" : data.target_type
  const value = data.type === "free_shipping" ? 100 : data.value

  const method: any = {}
  if (type) method.type = type
  if (target_type) method.target_type = target_type
  if (value !== undefined) method.value = value
  if (data.currency_code !== undefined) method.currency_code = data.currency_code
  if (type === "fixed" && target_type === "items") method.allocation = "across"
  if (data.type === "free_shipping") method.allocation = "each"
  return method
}

/**
 * Map a stored promotion to the merchant-facing shape. The real promotion `code`
 * is tenant-namespaced (see _promo-code.ts); the merchant must only ever see the
 * plain DISPLAY code, so we return metadata.display_code (falling back to
 * stripping the tenant prefix off the internal code for older rows).
 */
function formatDiscount(promotion: any, tenantId: string) {
  const method = promotion.application_method || {}
  let type: string = method.type || "percentage"
  if (
    method.type === "percentage" &&
    method.target_type === "shipping_methods" &&
    method.value === 100
  ) {
    type = "free_shipping"
  }
  const displayCode =
    promotion.metadata?.display_code ??
    denamespaceCode(tenantId, promotion.code)
  return {
    id: promotion.id,
    code: displayCode,
    type,
    status: promotion.status,
    value: method.value ?? 0,
    currency_code: method.currency_code ?? null,
    target_type: method.target_type ?? "order",
    usage_limit: promotion.limit ?? null,
    usage_count: promotion.used ?? 0,
    starts_at: promotion.starts_at ?? null,
    expires_at: promotion.expires_at ?? null,
    is_automatic: promotion.is_automatic ?? false,
    created_at: promotion.created_at,
    updated_at: promotion.updated_at,
  }
}

/**
 * Load a promotion only if it is tagged with this tenant's
 * metadata.tenant_id. Untagged / foreign rows resolve to null (fail-closed).
 */
async function findOwnedPromotion(req: MedusaRequest, tenantId: string, id: string) {
  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const [promotion] = await promotionModule.listPromotions(
    { id },
    { take: 1, relations: ["application_method"] }
  )
  if (!promotion || promotion.metadata?.tenant_id !== tenantId) return null
  return promotion
}

/**
 * GET /merchant/discounts/:id
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const promotion = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!promotion) return res.status(404).json({ message: "discount not found" })

  res.json({ discount: formatDiscount(promotion, ctx.tenant.id) })
}

/**
 * PUT /merchant/discounts/:id
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parsed = UpdateDiscountSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const existing = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "discount not found" })

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)

  const update: any = { id }
  // Code change: re-namespace and keep display_code in sync. Guard against
  // colliding with another of THIS tenant's codes (cross-tenant can't collide).
  if (parsed.data.code !== undefined) {
    const displayCode = parsed.data.code.trim()
    const internalCode = namespaceCode(ctx.tenant.id, displayCode)
    if (internalCode !== existing.code) {
      const clash = await promotionModule.listPromotions(
        { code: internalCode },
        { take: 1 }
      )
      if ((clash || []).some((p: any) => p.code === internalCode)) {
        return res.status(409).json({ message: "a discount with this code already exists" })
      }
    }
    update.code = internalCode
    update.metadata = {
      ...(existing.metadata || {}),
      tenant_id: ctx.tenant.id,
      display_code: displayCode,
    }
  }
  if (parsed.data.status !== undefined) update.status = parsed.data.status
  if (parsed.data.is_automatic !== undefined) update.is_automatic = parsed.data.is_automatic
  if (parsed.data.usage_limit !== undefined) update.limit = parsed.data.usage_limit
  if (parsed.data.starts_at !== undefined) {
    update.starts_at = parsed.data.starts_at
      ? new Date(parsed.data.starts_at).toISOString()
      : null
  }
  if (parsed.data.expires_at !== undefined) {
    update.expires_at = parsed.data.expires_at
      ? new Date(parsed.data.expires_at).toISOString()
      : null
  }

  const methodUpdate = buildApplicationMethod(parsed.data)
  if (Object.keys(methodUpdate).length) {
    update.application_method = methodUpdate
  }

  let promotion: any
  try {
    ;[promotion] = await promotionModule.updatePromotions([update])
  } catch (e: any) {
    return res.status(409).json({ message: "a discount with this code already exists" })
  }
  res.json({ discount: formatDiscount(promotion, ctx.tenant.id) })
}

/**
 * DELETE /merchant/discounts/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "discount not found" })

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  await promotionModule.deletePromotions([id])
  res.status(204).send()
}
