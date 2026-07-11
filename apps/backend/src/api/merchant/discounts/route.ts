import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import { namespaceCode, denamespaceCode } from "./_promo-code"

const DiscountTypeSchema = z.enum(["percentage", "fixed", "free_shipping"])
const StatusSchema = z.enum(["draft", "active", "inactive"])

const CreateDiscountSchema = z.object({
  code: z.string().min(1).max(100),
  type: DiscountTypeSchema,
  status: StatusSchema.default("draft"),
  value: z.number().int().min(0).default(0),
  currency_code: z.string().min(3).max(3).default("usd"),
  target_type: z.enum(["order", "items", "shipping_methods"]).default("order"),
  usage_limit: z.number().int().min(0).nullable().default(null),
  starts_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
  is_automatic: z.boolean().default(false),
})

function buildApplicationMethod(data: z.infer<typeof CreateDiscountSchema>) {
  const type = data.type === "free_shipping" ? "percentage" : (data.type as "percentage" | "fixed")
  const target_type = data.type === "free_shipping" ? "shipping_methods" : data.target_type
  const value = data.type === "free_shipping" ? 100 : data.value

  return {
    type,
    target_type,
    value,
    allocation:
      data.type === "fixed" && target_type === "items"
        ? "across"
        : data.type === "free_shipping"
        ? "each"
        : undefined,
    currency_code: type === "fixed" ? data.currency_code : undefined,
  }
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
 * GET /merchant/discounts
 *
 * Promotions are GLOBAL in Medusa, so rows are tagged with
 * metadata.tenant_id at creation and only this tenant's rows are returned.
 * Rows without a matching tenant_id (incl. pre-existing untagged rows) are
 * denied — fail-closed. Codes are returned as the plain DISPLAY code, never the
 * namespaced internal code.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const all = await promotionModule.listPromotions(
    {},
    {
      take: 200,
      skip: 0,
      order: { created_at: "DESC" },
      relations: ["application_method"],
    }
  )
  const promotions = (all || []).filter(
    (p: any) => p.metadata?.tenant_id === ctx.tenant.id
  )

  res.json({
    discounts: promotions.map((p: any) => formatDiscount(p, ctx.tenant.id)),
    count: promotions.length,
  })
}

/**
 * POST /merchant/discounts
 *
 * Creates a promotion tagged with this tenant's id. The merchant-entered code is
 * stored as metadata.display_code and the actual promotion `code` is set to the
 * tenant-namespaced value so it can never collide with another tenant's code.
 * If THIS tenant already has that display code, respond 409; another tenant
 * using the same display code does NOT conflict (different namespaced code).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateDiscountSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const displayCode = parsed.data.code.trim()
  const internalCode = namespaceCode(ctx.tenant.id, displayCode)

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)

  // Per-tenant uniqueness: the namespaced code embeds this tenant's id, so an
  // existing row with the same internal code can only be THIS tenant's.
  const clash = await promotionModule.listPromotions(
    { code: internalCode },
    { take: 1 }
  )
  if ((clash || []).some((p: any) => p.code === internalCode)) {
    return res.status(409).json({ message: "a discount with this code already exists" })
  }

  let promotion: any
  try {
    ;[promotion] = await promotionModule.createPromotions([
      {
        code: internalCode,
        type: "standard",
        status: parsed.data.status,
        is_automatic: parsed.data.is_automatic,
        limit: parsed.data.usage_limit,
        starts_at: parsed.data.starts_at
          ? new Date(parsed.data.starts_at).toISOString()
          : undefined,
        expires_at: parsed.data.expires_at
          ? new Date(parsed.data.expires_at).toISOString()
          : undefined,
        application_method: buildApplicationMethod(parsed.data),
        metadata: { tenant_id: ctx.tenant.id, display_code: displayCode },
      },
    ])
  } catch (e: any) {
    // Backstop: the DB enforces a unique constraint on promotion.code, so a race
    // (or any collision) surfaces here as a clean 409 rather than a 500.
    return res.status(409).json({ message: "a discount with this code already exists" })
  }

  res.status(201).json({ discount: formatDiscount(promotion, ctx.tenant.id) })
}
