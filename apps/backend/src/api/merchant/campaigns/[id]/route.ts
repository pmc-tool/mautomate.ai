import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  deleteCampaignsWorkflow,
  updateCampaignsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import {
  findOwnedCampaign,
  formatCampaignDetail,
  listCampaignPromotions,
  namespaceIdentifier,
} from "../_campaigns"

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  identifier: z.string().min(1).max(200).optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Budget TYPE and CURRENCY are immutable after creation (Medusa rule and
  // admin UX); only the numeric limit is editable. null removes the limit.
  budget: z
    .object({
      limit: z.number().min(0).nullable(),
    })
    .optional(),
})

/**
 * GET /merchant/campaigns/:id
 *
 * Detail = list item + budget used/limit + the tenant's promotions attached to
 * the campaign (PromotionListItem shape). Ownership is enforced through the
 * tenant-namespaced campaign_identifier (fail-closed 404 for foreign rows).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const campaign = await findOwnedCampaign(req, ctx.tenant.id, id)
  if (!campaign) return res.status(404).json({ message: "campaign not found" })

  const promotions = await listCampaignPromotions(req, ctx.tenant.id, campaign.id)

  res.json({
    campaign: formatCampaignDetail(campaign, promotions, ctx.tenant.id),
  })
}

/**
 * POST /merchant/campaigns/:id
 *
 * Partial update: name / description / identifier (re-namespaced) / dates
 * (null clears them) / budget limit. Budget type + currency are immutable.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parsed = UpdateCampaignSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const existing = await findOwnedCampaign(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "campaign not found" })

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const update: any = { id: existing.id }

  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim()
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description?.trim() || null
  }

  // Identifier change: re-namespace and guard against colliding with another
  // of THIS tenant's campaigns (cross-tenant collision is impossible because
  // the internal identifier embeds the tenant id).
  if (parsed.data.identifier !== undefined) {
    const internalIdentifier = namespaceIdentifier(
      ctx.tenant.id,
      parsed.data.identifier.trim()
    )
    if (internalIdentifier !== existing.campaign_identifier) {
      const clash = await promotionModule.listCampaigns(
        { campaign_identifier: internalIdentifier },
        { take: 1 }
      )
      if (
        (clash || []).some(
          (c: any) => c.campaign_identifier === internalIdentifier
        )
      ) {
        return res
          .status(409)
          .json({ message: "a campaign with this identifier already exists" })
      }
    }
    update.campaign_identifier = internalIdentifier
  }

  if (parsed.data.starts_at !== undefined) {
    update.starts_at = parsed.data.starts_at
      ? new Date(parsed.data.starts_at)
      : null
  }
  if (parsed.data.ends_at !== undefined) {
    update.ends_at = parsed.data.ends_at ? new Date(parsed.data.ends_at) : null
  }

  if (parsed.data.budget !== undefined) {
    if (!existing.budget) {
      return res
        .status(400)
        .json({ message: "this campaign has no budget to update" })
    }
    update.budget = { limit: parsed.data.budget.limit }
  }

  try {
    await updateCampaignsWorkflow(req.scope).run({
      input: { campaignsData: [update] },
    })
  } catch (e: any) {
    const message = e?.message || ""
    if (/unique|duplicate|already exists/i.test(message)) {
      return res
        .status(409)
        .json({ message: "a campaign with this identifier already exists" })
    }
    return res
      .status(400)
      .json({ message: message || "failed to update campaign" })
  }

  const updated = await findOwnedCampaign(req, ctx.tenant.id, id)
  if (!updated) return res.status(404).json({ message: "campaign not found" })
  const promotions = await listCampaignPromotions(req, ctx.tenant.id, updated.id)

  res.json({
    campaign: formatCampaignDetail(updated, promotions, ctx.tenant.id),
  })
}

/**
 * DELETE /merchant/campaigns/:id
 *
 * Soft-deletes the campaign (budget cascades; attached promotions survive and
 * simply lose their campaign, matching Medusa admin behavior).
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await findOwnedCampaign(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "campaign not found" })

  try {
    await deleteCampaignsWorkflow(req.scope).run({
      input: { ids: [existing.id] },
    })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to delete campaign" })
  }

  res.status(204).send()
}
