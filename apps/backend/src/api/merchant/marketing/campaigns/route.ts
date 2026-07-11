import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"

const STATUSES = ["draft", "active", "paused", "completed"] as const

const parseDate = (v: any): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/**
 * GET /merchant/marketing/campaigns
 *
 * Merchant-scoped list of marketing campaigns. Query params: status, limit, offset.
 * Response: { campaigns, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: tenantId }
    if (req.query.status) {
      filters.status = req.query.status
    }

    const [campaigns, count] = await svc.listAndCountMarketingCampaigns(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ campaigns, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list campaigns",
    })
  }
}

/**
 * POST /merchant/marketing/campaigns
 *
 * Create a merchant-scoped marketing campaign, tagged with the caller's tenant.
 * Body: { name, objective?, status?, starts_at?, ends_at?, product_ids?,
 *         channel_mix? }
 * Response: { campaign }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) {
      return res.status(400).json({ message: "A campaign requires a `name`." })
    }

    const status =
      typeof b.status === "string" &&
      (STATUSES as readonly string[]).includes(b.status)
        ? b.status
        : "draft"

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingCampaigns({
      tenant_id: tenantId,
      name,
      objective: typeof b.objective === "string" ? b.objective.trim() : null,
      status,
      starts_at: parseDate(b.starts_at),
      ends_at: parseDate(b.ends_at),
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : null,
      channel_mix: b.channel_mix ?? null,
    } as any)

    const campaign = Array.isArray(created) ? created[0] : created

    res.status(201).json({ campaign })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to create campaign",
    })
  }
}
