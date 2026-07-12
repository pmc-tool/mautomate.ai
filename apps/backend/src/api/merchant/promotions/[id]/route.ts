import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  deletePromotionsWorkflow,
  updatePromotionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { namespaceCode } from "../../discounts/_promo-code"
import {
  IsoDateString,
  buildPromotionDetail,
  findOwnedCampaign,
  findOwnedPromotion,
  refetchPromotionDetail,
  tenantCurrencies,
} from "../_shared"

/**
 * GET /merchant/promotions/:id
 *
 * Full promotion detail with application method, campaign and all three rule
 * groups (attribute_label / operator_label / value labels hydrated
 * server-side). Ownership: metadata.tenant_id must match — fail-closed.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const promotion = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!promotion) {
    return res.status(404).json({ message: "promotion not found" })
  }

  const detail = await buildPromotionDetail(req, ctx, promotion)
  res.json({ promotion: detail })
}

const UpdateApplicationMethodSchema = z.object({
  type: z.enum(["fixed", "percentage"]).optional(),
  target_type: z.enum(["items", "shipping_methods", "order"]).optional(),
  value: z.coerce.number().min(0).optional(),
  currency_code: z.string().length(3).optional(),
  allocation: z.enum(["each", "across", "once"]).optional(),
  max_quantity: z.coerce.number().int().min(1).nullable().optional(),
  apply_to_quantity: z.coerce.number().int().min(1).nullable().optional(),
  buy_rules_min_quantity: z.coerce
    .number()
    .int()
    .min(1)
    .nullable()
    .optional(),
})

const UpdatePromotionSchema = z.object({
  display_code: z.string().min(1).max(100).optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
  is_automatic: z.boolean().optional(),
  is_tax_inclusive: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).nullable().optional(),
  application_method: UpdateApplicationMethodSchema.optional(),
  campaign_id: z.string().min(1).nullable().optional(),
  starts_at: IsoDateString.nullable().optional(),
  ends_at: IsoDateString.nullable().optional(),
})

/**
 * POST /merchant/promotions/:id
 *
 * Partial update via updatePromotionsWorkflow. Code changes are re-namespaced
 * (metadata.display_code kept in sync, per-tenant clash check). campaign_id
 * set/unset goes through the workflow input directly — UpdatePromotionDTO
 * accepts campaign_id: string | null and the promotion module handles both
 * (verified against the installed 2.17 dist), so
 * addOrRemoveCampaignPromotionsWorkflow is not needed here. Scheduling dates
 * round-trip through metadata.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = UpdatePromotionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }
  const data = parsed.data

  const { id } = req.params
  const existing = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!existing) {
    return res.status(404).json({ message: "promotion not found" })
  }

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)

  const update: any = { id }
  const metadata: Record<string, any> = {
    ...(existing.metadata || {}),
    tenant_id: ctx.tenant.id,
  }
  let metadataChanged = false
  let codeChanged = false

  // Code change: re-namespace and keep display_code in sync. Guard against
  // colliding with another of THIS tenant's codes (cross-tenant can't collide).
  if (data.display_code !== undefined) {
    const displayCode = data.display_code.trim()
    const internalCode = namespaceCode(ctx.tenant.id, displayCode)
    if (internalCode !== existing.code) {
      const clash = await promotionModule.listPromotions(
        { code: internalCode },
        { take: 1 }
      )
      if ((clash || []).some((p: any) => p.code === internalCode)) {
        return res
          .status(409)
          .json({ message: "a promotion with this code already exists" })
      }
      update.code = internalCode
      codeChanged = true
    }
    metadata.display_code = displayCode
    metadataChanged = true
  }

  if (data.starts_at !== undefined) {
    metadata.starts_at = data.starts_at
      ? new Date(data.starts_at).toISOString()
      : null
    metadataChanged = true
  }
  if (data.ends_at !== undefined) {
    metadata.ends_at = data.ends_at
      ? new Date(data.ends_at).toISOString()
      : null
    metadataChanged = true
  }
  if (metadataChanged) update.metadata = metadata

  if (data.status !== undefined) update.status = data.status
  if (data.is_automatic !== undefined) update.is_automatic = data.is_automatic
  if (data.is_tax_inclusive !== undefined) {
    update.is_tax_inclusive = data.is_tax_inclusive
  }
  if (data.limit !== undefined) update.limit = data.limit

  if (data.application_method) {
    const am: any = { ...data.application_method }
    const { currencies, default_currency } = tenantCurrencies(ctx)
    if (am.currency_code) am.currency_code = am.currency_code.toLowerCase()
    if (
      am.type === "fixed" &&
      !am.currency_code &&
      !existing.application_method?.currency_code
    ) {
      am.currency_code = default_currency
    }
    if (am.currency_code && !currencies.includes(am.currency_code)) {
      return res.status(400).json({
        message: `currency ${am.currency_code} is not enabled for this store`,
      })
    }
    if (am.allocation === "across") am.max_quantity = null
    update.application_method = am
  }

  // Campaign set / unset — campaigns have no metadata in 2.17, ownership is
  // proven via the "<tenantId>:" prefix on campaign_identifier (fail-closed).
  if (data.campaign_id !== undefined) {
    if (data.campaign_id === null) {
      update.campaign_id = null
    } else {
      const campaign = await findOwnedCampaign(
        req,
        ctx.tenant.id,
        data.campaign_id
      )
      if (!campaign) {
        return res.status(404).json({ message: "campaign not found" })
      }
      update.campaign_id = data.campaign_id
    }
  }

  try {
    await updatePromotionsWorkflow(req.scope).run({
      input: { promotionsData: [update] },
    })
  } catch (e: any) {
    const message = e?.message ?? "failed to update promotion"
    if (codeChanged && /already exists|duplicate|unique/i.test(message)) {
      return res
        .status(409)
        .json({ message: "a promotion with this code already exists" })
    }
    return res.status(400).json({ message })
  }

  const detail = await refetchPromotionDetail(req, ctx, id)
  res.json({ promotion: detail })
}

/**
 * DELETE /merchant/promotions/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!existing) {
    return res.status(404).json({ message: "promotion not found" })
  }

  try {
    await deletePromotionsWorkflow(req.scope).run({ input: { ids: [id] } })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message ?? "failed to delete promotion" })
  }

  res.json({ id, object: "promotion", deleted: true })
}
