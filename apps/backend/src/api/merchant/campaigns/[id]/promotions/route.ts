import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { addOrRemoveCampaignPromotionsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { denamespaceCode } from "../../../discounts/_promo-code"
import {
  findOwnedCampaign,
  formatCampaignDetail,
  listCampaignPromotions,
} from "../../_campaigns"

const BatchPromotionsSchema = z
  .object({
    add: z.array(z.string().min(1)).max(100).optional().default([]),
    remove: z.array(z.string().min(1)).max(100).optional().default([]),
  })
  .refine((data) => data.add.length + data.remove.length > 0, {
    message: "provide at least one promotion id in add or remove",
  })

/**
 * POST /merchant/campaigns/:id/promotions   { add?: string[], remove?: string[] }
 *
 * Attaches/detaches promotions via addOrRemoveCampaignPromotionsWorkflow.
 * Ownership is enforced on BOTH sides before the workflow runs:
 *  - the campaign must carry THIS tenant's campaign_identifier prefix, and
 *  - EVERY referenced promotion must be tagged metadata.tenant_id for this
 *    tenant. Any unknown or foreign id fails the whole request with 404
 *    (fail-closed, no partial writes, no leak of which id was foreign).
 *
 * Additional guards mirroring Medusa admin's add-promotions modal rules:
 *  - a promotion already in a DIFFERENT campaign cannot be added,
 *  - for spend budgets the promotion currency must match the budget currency,
 *  - remove ids must currently belong to THIS campaign.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parsed = BatchPromotionsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const campaign = await findOwnedCampaign(req, ctx.tenant.id, id)
  if (!campaign) return res.status(404).json({ message: "campaign not found" })

  const addIds = Array.from(new Set(parsed.data.add))
  const removeIds = Array.from(new Set(parsed.data.remove))
  const overlap = addIds.filter((pid) => removeIds.includes(pid))
  if (overlap.length) {
    return res.status(400).json({
      message: "a promotion cannot be both added and removed in one request",
    })
  }

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const allIds = [...addIds, ...removeIds]
  const found = await promotionModule.listPromotions(
    { id: allIds },
    { take: allIds.length, relations: ["application_method"] }
  )
  const byId = new Map<string, any>((found || []).map((p: any) => [p.id, p]))

  // Ownership check on EVERY referenced promotion — unknown ids and foreign
  // tenants' rows are indistinguishable in the response (fail-closed).
  for (const pid of allIds) {
    const promotion = byId.get(pid)
    if (!promotion || promotion.metadata?.tenant_id !== ctx.tenant.id) {
      return res.status(404).json({ message: "promotion not found" })
    }
  }

  const displayCode = (p: any): string =>
    p.metadata?.display_code ?? denamespaceCode(ctx.tenant.id, p.code || "")

  // Validate adds: skip promotions already in this campaign (idempotent),
  // reject promotions attached to another campaign or with a mismatched
  // currency against a spend budget.
  const addFinal: string[] = []
  for (const pid of addIds) {
    const promotion = byId.get(pid)
    const currentCampaignId = promotion.campaign_id ?? promotion.campaign?.id ?? null
    if (currentCampaignId === campaign.id) continue
    if (currentCampaignId) {
      return res.status(400).json({
        message: `promotion "${displayCode(promotion)}" is already part of a different campaign`,
      })
    }
    if (
      campaign.budget?.type === "spend" &&
      promotion.application_method?.currency_code !== campaign.budget?.currency_code
    ) {
      return res.status(400).json({
        message: `currency of promotion "${displayCode(promotion)}" does not match the campaign budget currency`,
      })
    }
    addFinal.push(pid)
  }

  // Validate removes: the promotion must currently belong to THIS campaign.
  for (const pid of removeIds) {
    const promotion = byId.get(pid)
    const currentCampaignId = promotion.campaign_id ?? promotion.campaign?.id ?? null
    if (currentCampaignId !== campaign.id) {
      return res.status(400).json({
        message: `promotion "${displayCode(promotion)}" is not part of this campaign`,
      })
    }
  }

  if (addFinal.length || removeIds.length) {
    try {
      await addOrRemoveCampaignPromotionsWorkflow(req.scope).run({
        input: { id: campaign.id, add: addFinal, remove: removeIds },
      })
    } catch (e: any) {
      return res
        .status(400)
        .json({ message: e?.message || "failed to update campaign promotions" })
    }
  }

  const updated = await findOwnedCampaign(req, ctx.tenant.id, campaign.id)
  if (!updated) return res.status(404).json({ message: "campaign not found" })
  const promotions = await listCampaignPromotions(req, ctx.tenant.id, updated.id)

  res.json({
    campaign: formatCampaignDetail(updated, promotions, ctx.tenant.id),
  })
}
