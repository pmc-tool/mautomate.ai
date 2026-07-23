import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import {
  launchCampaign,
  setCampaignStatus,
  storeBaseUrl,
} from "../../../modules/marketing/ads"

/**
 * Pixi P1 — ADS (advertising) HARD write tools.
 *
 * Two tools that spend the merchant's money on ads, so both are `tier:"hard"`
 * with a `requireText` word the merchant must type — the runtime gates on that,
 * not this file:
 *
 *   - create_ad_campaign  ("RUN")    — creates a Facebook/Meta ad campaign for a
 *     product. Mirrors POST /merchant/ads/campaigns EXACTLY: it calls
 *     `launchCampaign(mk, tenantId, spec)`, which ALWAYS creates the campaign
 *     PAUSED. Creating a campaign commits no spend by itself, but it stands the
 *     campaign up on the ad platform and is the money-shaped half of the flow,
 *     so it is confirm-gated.
 *   - launch_ad_campaign  ("LAUNCH") — flips a PAUSED campaign to ACTIVE via
 *     `setCampaignStatus(..., "active")`. THIS is where real spend begins.
 *
 * CONTRACT (mirrors _writes-money.ts so the registry can concat both):
 *   - The MODEL only ever supplies plain descriptors (a product name, a budget,
 *     a campaign name). It NEVER supplies internal ids, external ids, or the
 *     tenant — those are resolved server-side from `ctx`.
 *   - `plan()` MUST NOT mutate. It resolves the product / campaign tenant-scoped,
 *     validates, and returns a precise `human_summary`. On any invalid state it
 *     returns `{ ok:false, error }` in plain language — it never throws.
 *   - `apply()` runs the real ads-module function tenant-scoped and returns
 *     `{ result, undo }`. It re-derives the tenant from `ctx`, never from args.
 */

export type Ctx = { tenant: any; merchant: any; svc: any }
export type PlanResult =
  | { ok: true; human_summary: string; details: Record<string, unknown>; apply_args: Record<string, any> }
  | { ok: false; error: string }
export type ApplyResult = { result: any; undo?: { action: string; apply_args: Record<string, any> } | { available: false; reason: string } }
export type JarvisWrite = {
  name: string; description: string; parameters: Record<string, unknown>
  risk: "low" | "med" | "high"; tier: "soft" | "hard"; requireText?: string
  plan(req: MedusaRequest, ctx: Ctx, args: Record<string, any>): Promise<PlanResult>
  apply(req: MedusaRequest, ctx: Ctx, applyArgs: Record<string, any>): Promise<ApplyResult>
}

/* --------------------------------- helpers -------------------------------- */

/** Ads run on the "mock" provider under MARKETING_ADS_MOCK (simulated, no real
 *  spend) and on "meta" otherwise — exactly the platform key the rest of the
 *  ads subsystem registers. Facebook + Instagram are both Meta. */
const adsMock = () => process.env.MARKETING_ADS_MOCK === "1"
const providerPlatform = () => (adsMock() ? "mock" : "meta")

/** Map a free-text objective to the platform goal the ads module accepts. */
const goalFromObjective = (obj?: string): "sales" | "traffic" | "awareness" => {
  const s = (obj || "").toLowerCase()
  if (/traffic|click|visit|store/.test(s)) return "traffic"
  if (/aware|brand|reach|impression|view/.test(s)) return "awareness"
  return "sales"
}

const currencyOf = (ctx: Ctx) =>
  String(ctx.tenant.meta?.currency_code ?? "usd").toUpperCase()

/**
 * Resolve ONE of this store's products by title — identical shape to the P0
 * search_products tool: walk the sales-channel product links, drop the sample
 * product, then match the title. Returns the title + handle, or a plain-language
 * error. Never throws.
 */
async function resolveProduct(
  req: MedusaRequest,
  ctx: Ctx,
  term: string
): Promise<{ title: string; handle: string } | { error: string }> {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { error: "your store isn't fully set up yet, so I can't find products." }
  const needle = String(term ?? "").toLowerCase().trim()
  if (!needle) return { error: "which product should the ad promote? Tell me its name." }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
    pagination: { take: 2000, skip: 0 } as any,
  })
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return { error: "you don't have any products to advertise yet." }

  const { data: products } = await query.graph({
    entity: "product",
    filters: { id: ids } as any,
    fields: ["id", "title", "handle", "status", "metadata"],
    pagination: { take: 2000, skip: 0 } as any,
  })
  const rows = (products || []).filter((p: any) => !p.metadata?.is_sample)
  if (!rows.length) return { error: "you don't have any real products to advertise yet." }

  // Prefer an exact title match, then a contains match (shortest title wins so
  // "Kaftan" doesn't grab "Kaftan Gift Set" when an exact one exists).
  const exact = rows.find((p: any) => (p.title || "").toLowerCase() === needle)
  const partial = rows
    .filter((p: any) => (p.title || "").toLowerCase().includes(needle))
    .sort((a: any, b: any) => (a.title || "").length - (b.title || "").length)[0]
  const match = exact ?? partial
  if (!match) return { error: `I couldn't find a product called "${term}" in your store.` }
  if (!match.handle) return { error: `"${match.title}" isn't set up with a public page yet, so it can't be advertised.` }
  return { title: match.title, handle: match.handle }
}

/* =========================== 1. create_ad_campaign ======================== */

const createAdCampaign: JarvisWrite = {
  name: "create_ad_campaign",
  description:
    "Create a Facebook/Meta ad campaign that promotes one of the store's products. Use for 'advertise my Blue Kaftan on Facebook', 'run an ad for that product at $5 a day', 'set up a Facebook campaign'. The campaign is ALWAYS created PAUSED — it does not go live or spend until the merchant launches it. This stands a campaign up on the ad platform, so it is confirm-gated.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: "The product to advertise, by name, e.g. 'Blue Kaftan'" },
      daily_budget: { type: "number", description: "Daily ad budget in the store's currency (whole units), e.g. 5" },
      platform: {
        type: "string",
        enum: ["facebook", "instagram", "meta"],
        description: "Ad platform (default facebook)",
      },
      objective: { type: "string", description: "Optional goal, e.g. 'Sales', 'Traffic', 'Awareness' (default Sales)" },
    },
    required: ["product_query", "daily_budget"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "RUN",

  async plan(req, ctx, args) {
    const p = await resolveProduct(req, ctx, args.product_query)
    if ("error" in p) return { ok: false, error: p.error }

    const budget = Number(args.daily_budget)
    if (!(budget > 0)) {
      return { ok: false, error: "tell me a daily budget greater than zero, e.g. 5 a day." }
    }

    // Destination link — the ad points at the product page on the store's own
    // public domain, exactly like the campaigns route builds it.
    const base = await storeBaseUrl(req.scope, ctx.tenant.id).catch(() => null)
    if (!base) {
      return { ok: false, error: "your store's public web address isn't set up yet, so I can't point an ad at it." }
    }
    const linkUrl = `${base}/products/${p.handle}`

    // Where to advertise — the store's country, else a sensible default.
    const country = String(ctx.tenant.meta?.default_country ?? "").toUpperCase()
    const countries = country ? [country] : ["US"]

    const cur = currencyOf(ctx)
    const goal = goalFromObjective(args.objective)
    const objectiveLabel =
      typeof args.objective === "string" && args.objective.trim()
        ? args.objective.trim()
        : "Sales"
    const name = `${p.title} — ${objectiveLabel}`

    // Simple, honest ad copy derived from the product — kept in-process so plan()
    // stays read-only and free (the metered ads/ai copy generator can enrich this
    // later from the panel). The ads module requires a headline + primary text.
    const headline = p.title.length <= 40 ? p.title : `${p.title.slice(0, 37)}...`
    const primaryText = `Shop ${p.title} at ${ctx.tenant.name ?? "our store"}. Order now.`

    return {
      ok: true,
      human_summary: `Create a Facebook ad campaign for "${p.title}" at ${budget} ${cur}/day? It starts paused so you can review and launch it.`,
      details: {
        product: p.title,
        daily_budget: budget,
        currency: cur,
        countries,
        objective: objectiveLabel,
        goal,
        starts: "paused",
      },
      apply_args: {
        platform: providerPlatform(),
        name,
        goal,
        daily_budget: budget,
        currency: ctx.tenant.meta?.currency_code ?? null,
        countries,
        product_handle: p.handle,
        link_url: linkUrl,
        headline,
        primary_text: primaryText,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    // Tenant comes from the live session ONLY — never from applyArgs.
    const campaign = await launchCampaign(mk, ctx.tenant.id, {
      platform: applyArgs.platform,
      name: applyArgs.name,
      goal: applyArgs.goal,
      daily_budget: Number(applyArgs.daily_budget),
      currency: applyArgs.currency ?? null,
      countries: Array.isArray(applyArgs.countries) ? applyArgs.countries : [],
      genders: null,
      age_min: null,
      age_max: null,
      link_url: applyArgs.link_url,
      headline: applyArgs.headline,
      primary_text: applyArgs.primary_text,
      image_url: null,
      page_id: null,
      pixel_external_id: null,
      start_at: null,
      source: "ai",
      actorUserId: ctx.merchant?.id ?? null,
    })
    return {
      result: {
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      undo: {
        available: false,
        reason: "a created campaign can be paused or deleted from the Advertising panel",
      },
    }
  },
}

/* =========================== 2. launch_ad_campaign ======================== */

/** Find this store's most-recent PAUSED campaign, optionally by name. Tenant is
 *  read from ctx only. Never throws; returns a plain-language error on a miss. */
async function resolvePausedCampaign(
  req: MedusaRequest,
  ctx: Ctx,
  nameQuery?: string
): Promise<any | { error: string }> {
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  const [campaigns] = await mk.listAndCountAdsCampaigns(
    { tenant_id: ctx.tenant.id, status: "paused" },
    { take: 100, skip: 0, order: { updated_at: "DESC" } }
  )
  const rows = campaigns ?? []
  if (!rows.length) {
    return { error: "you don't have a paused campaign ready to launch. Create one first." }
  }
  const needle = String(nameQuery ?? "").toLowerCase().trim()
  if (needle) {
    const match =
      rows.find((c: any) => (c.name || "").toLowerCase() === needle) ??
      rows.find((c: any) => (c.name || "").toLowerCase().includes(needle))
    if (!match) return { error: `I couldn't find a paused campaign called "${nameQuery}".` }
    return match
  }
  return rows[0]
}

const launchAdCampaign: JarvisWrite = {
  name: "launch_ad_campaign",
  description:
    "Launch (go live with) a PAUSED ad campaign so it starts running and SPENDING the daily budget. Use for 'launch my campaign', 'set the Blue Kaftan ad live', 'start spending on that campaign'. With no name it launches your most recent paused campaign. This begins real ad spend, so it is confirm-gated.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Optional campaign name to launch, e.g. 'Blue Kaftan — Sales'" },
      campaign_query: { type: "string", description: "Alias for name — the campaign to launch, by name" },
    },
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "LAUNCH",

  async plan(req, ctx, args) {
    const c = await resolvePausedCampaign(req, ctx, args.name ?? args.campaign_query)
    if (c && "error" in c) return { ok: false, error: c.error }

    const cur = String(c.currency ?? currencyOf(ctx)).toUpperCase()
    const budget = c.daily_budget != null ? `${c.daily_budget} ${cur}/day` : "its set budget"
    const sim = adsMock()
      ? " Ads are in demo mode, so this is simulated — no real money is spent."
      : ""

    return {
      ok: true,
      human_summary: `Launch "${c.name}" so it goes LIVE and starts spending ${budget}?${sim}`,
      details: {
        campaign: c.name,
        daily_budget: c.daily_budget ?? null,
        currency: cur,
        platform: c.platform,
        simulated: adsMock(),
      },
      apply_args: { campaign_id: c.id },
    }
  },

  async apply(req, ctx, applyArgs) {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    // setCampaignStatus is fail-closed tenant-scoped (it re-looks the campaign up
    // by { id, tenant_id }) and respects the platform gate exactly as the panel
    // route does — a foreign or draft campaign cannot be flipped from here.
    const updated = await setCampaignStatus(
      mk,
      ctx.tenant.id,
      applyArgs.campaign_id,
      "active",
      "ai",
      "Launched via Pixi"
    )
    return {
      result: {
        campaign_id: updated?.id ?? applyArgs.campaign_id,
        name: updated?.name,
        status: updated?.status ?? "active",
      },
      undo: {
        available: false,
        reason: "pause it from the Advertising panel",
      },
    }
  },
}

/* ------------------------------- registry -------------------------------- */

export const ADS_WRITES: JarvisWrite[] = [createAdCampaign, launchAdCampaign]
