import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"
import { launchCampaign, storeBaseUrl } from "../../../../modules/marketing/ads"
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

/**
 * POST /merchant/ads/campaigns — create a campaign from the wizard's unified
 * spec. ALWAYS created PAUSED on the platform; the merchant launches it from
 * the campaign page as a separate explicit action.
 *
 * Body: { platform, name, goal, daily_budget, countries[], link_url,
 *         headline, primary_text, image_url?, page_id?, start_at? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    // The wizard sends a product handle; the ad's destination link is built
    // here because only the backend knows the store's public domain.
    let linkUrl = b.link_url as string | undefined
    if (!linkUrl && b.product_handle) {
      const base = await storeBaseUrl(req.scope, ctx.tenant.id)
      if (base) linkUrl = `${base}/products/${b.product_handle}`
    }
    if (!linkUrl && !b.product_handle) {
      const base = await storeBaseUrl(req.scope, ctx.tenant.id)
      if (base) linkUrl = base
    }

    const campaign = await launchCampaign(mk, ctx.tenant.id, {
      platform: b.platform,
      name: b.name,
      goal: b.goal,
      daily_budget: Number(b.daily_budget),
      currency: b.currency ?? null,
      countries: Array.isArray(b.countries) ? b.countries : [],
      link_url: linkUrl as string,
      headline: b.headline,
      primary_text: b.primary_text,
      image_url: b.image_url ?? null,
      page_id: b.page_id ?? null,
      pixel_external_id: null,
      start_at: b.start_at ?? null,
      source: "panel",
      actorUserId: (req as any).auth_context?.actor_id ?? null,
    })
    res.status(201).json({
      campaign: {
        id: campaign.id,
        external_id: campaign.external_id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        daily_budget: campaign.daily_budget,
        currency: campaign.currency,
      },
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Could not create the campaign" })
  }
}
