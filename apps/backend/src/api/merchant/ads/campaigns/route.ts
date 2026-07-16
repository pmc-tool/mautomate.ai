import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

/**
 * GET /merchant/ads/campaigns?status=&limit=&offset=
 *
 * The mirrored campaign list for this tenant (metrics live in /overview; this
 * is the raw entity list for the campaigns table and later detail pages).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const status = req.query.status as string | undefined

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const [campaigns, count] = await mk.listAndCountAdsCampaigns(
      { tenant_id: ctx.tenant.id, ...(status ? { status } : {}) },
      { take: limit, skip: offset, order: { updated_at: "DESC" } }
    )
    res.json({
      campaigns: (campaigns ?? []).map((c: any) => ({
        id: c.id,
        external_id: c.external_id,
        platform: c.platform,
        name: c.name,
        objective: c.objective,
        status: c.status,
        external_status: c.external_status,
        source: c.source,
        daily_budget: c.daily_budget,
        lifetime_budget: c.lifetime_budget,
        currency: c.currency,
        start_at: c.start_at,
        end_at: c.end_at,
        last_synced_at: c.last_synced_at,
      })),
      count,
      limit,
      offset,
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load campaigns" })
  }
}
