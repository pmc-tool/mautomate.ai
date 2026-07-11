import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const STATUSES = ["draft", "active", "paused", "completed"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

const parseDate = (v: any): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Load a campaign and assert tenant ownership. Fail-closed and null-safe: a
 * missing row OR a tenant_id not strictly equal to the caller's tenant (incl.
 * null/undefined) 404s and returns null.
 */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const campaign = await (svc as any)
    .retrieveMarketingCampaign(id)
    .catch(() => null)
  if (!campaign || campaign.tenant_id !== tenantId) {
    res.status(404).json({ message: `Campaign ${id} was not found` })
    return null
  }
  return campaign
}

/**
 * GET /merchant/marketing/campaigns/:id
 * Tenant-scoped. Response: { campaign }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const campaign = await loadOwned(svc, id, tenantId, res)
    if (!campaign) return
    res.json({ campaign })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve campaign",
    })
  }
}

/**
 * PUT /merchant/marketing/campaigns/:id
 *
 * Update a campaign (tenant-scoped). Only provided fields change.
 * Body: { name?, objective?, status?, starts_at?, ends_at?, product_ids?,
 *         channel_mix? }
 * Response: { campaign }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        return res
          .status(400)
          .json({ message: "`name` cannot be empty." })
      }
      data.name = name
    }
    if (b.objective !== undefined) {
      data.objective =
        typeof b.objective === "string" ? b.objective.trim() || null : null
    }
    if (b.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(b.status)) {
        return res.status(400).json({
          message: `\`status\` must be one of: ${STATUSES.join(", ")}.`,
        })
      }
      data.status = b.status
    }
    if (b.starts_at !== undefined) data.starts_at = parseDate(b.starts_at)
    if (b.ends_at !== undefined) data.ends_at = parseDate(b.ends_at)
    if (b.product_ids !== undefined) {
      data.product_ids = Array.isArray(b.product_ids) ? b.product_ids : null
    }
    if (b.channel_mix !== undefined) data.channel_mix = b.channel_mix ?? null

    const updated = await (svc as any).updateMarketingCampaigns({ id, ...data })
    const campaign = Array.isArray(updated) ? updated[0] : updated

    res.json({ campaign })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to update campaign",
    })
  }
}

/**
 * DELETE /merchant/marketing/campaigns/:id
 * Tenant-scoped. Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    await (svc as any).deleteMarketingCampaigns(id)

    res.json({ id, object: "marketing_campaign", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete campaign",
    })
  }
}
