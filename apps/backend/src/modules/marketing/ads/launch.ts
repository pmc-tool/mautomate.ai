import { MedusaError } from "@medusajs/framework/utils"
import { getAdsProvider } from "./registry"
import { openAdsConnectionCredentials } from "./credentials"
import type { AdsCredentials, UnifiedCampaignSpec } from "./types"

/**
 * Campaign lifecycle — the panel's write path. Three rules are load-bearing:
 *
 *  1. EVERYTHING IS CREATED PAUSED. launchCampaign never produces a running
 *     ad; going live is always the separate, explicit setCampaignStatus call
 *     a merchant makes with their own click.
 *  2. EVERY MUTATION IS LOGGED to ads_action_log with actor, reason, and a
 *     before/after snapshot — the accountability layer the AI/autopilot
 *     phases plug into.
 *  3. THE LOCAL ROW IS CREATED FIRST (status `draft`), then the platform
 *     call. A platform failure flips it to `error` with the message kept —
 *     nothing half-created is ever invisible.
 */

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/** The tenant's connected connection + selected active account on a platform. */
export const requireAccountContext = async (
  mk: any,
  tenantId: string,
  platform: string
): Promise<{ connection: any; account: any; creds: AdsCredentials }> => {
  const connection = first(
    await mk.listAdsConnections({
      tenant_id: tenantId,
      platform,
      status: "connected",
    })
  )
  if (!connection) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Connect ${platform} advertising first.`
    )
  }
  const account = first(
    await mk.listAdsAccounts({
      tenant_id: tenantId,
      platform,
      selected: true,
      status: "active",
    })
  )
  if (!account) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Choose an ad account first ("Use this account" on the Ad accounts page).'
    )
  }
  const creds = openAdsConnectionCredentials(connection)
  if (!creds) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Your ${platform} connection has expired — please reconnect.`
    )
  }
  return { connection, account, creds }
}

export type LaunchInput = UnifiedCampaignSpec & {
  platform: string
  /** Who is creating this (merchant now; `ai` from Phase 4). */
  source?: "panel" | "ai"
  actorUserId?: string | null
}

const validateSpec = (input: LaunchInput): void => {
  const bad = (msg: string) => {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, msg)
  }
  if (!input.name?.trim()) bad("The campaign needs a name.")
  if (!["sales", "traffic", "awareness"].includes(input.goal))
    bad("`goal` must be sales, traffic, or awareness.")
  if (!(Number(input.daily_budget) > 0))
    bad("The daily budget must be greater than zero.")
  if (!Array.isArray(input.countries) || input.countries.length === 0)
    bad("Pick at least one country to advertise in.")
  if (!input.link_url?.startsWith("http"))
    bad("The ad needs a destination link (your product or store page).")
  if (!input.headline?.trim()) bad("The ad needs a headline.")
  if (!input.primary_text?.trim()) bad("The ad needs its main text.")
}

/**
 * Create a campaign from a unified spec: local draft row -> platform create
 * (PAUSED) -> mirror rows for the ad set and ad -> audit log. Returns the
 * local ads_campaign row.
 */
export const launchCampaign = async (
  mk: any,
  tenantId: string,
  input: LaunchInput
): Promise<any> => {
  validateSpec(input)
  const provider = getAdsProvider(input.platform)
  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Advertising on "${input.platform}" is not available yet.`
    )
  }
  const { connection, account, creds } = await requireAccountContext(
    mk,
    tenantId,
    input.platform
  )

  if (input.platform === "meta" && !input.page_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Pick the Facebook Page the ad publishes as."
    )
  }

  // Sales optimization needs the purchase signal — an honest gate, not a
  // silent downgrade to traffic.
  if (input.goal === "sales") {
    const pixel = first(
      await mk.listAdsPixels({
        tenant_id: tenantId,
        platform: input.platform,
        status: "active",
      })
    )
    if (!pixel) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "A Sales campaign optimizes for purchases, which needs your pixel. Set it up first (Ad accounts → Tracking & catalog) — it is one click."
      )
    }
    input.pixel_external_id = pixel.external_id
  }

  const spec: UnifiedCampaignSpec = {
    name: input.name.trim(),
    goal: input.goal,
    daily_budget: Number(input.daily_budget),
    currency: input.currency ?? account.currency ?? null,
    countries: input.countries.map((c) => String(c).toUpperCase()),
    link_url: input.link_url,
    headline: input.headline.trim(),
    primary_text: input.primary_text.trim(),
    image_url: input.image_url ?? null,
    page_id: input.page_id ?? null,
    pixel_external_id: input.pixel_external_id ?? null,
    start_at: input.start_at ?? null,
  }

  const campaign = first(
    await mk.createAdsCampaigns({
      tenant_id: tenantId,
      account_id: account.id,
      platform: input.platform,
      external_id: null,
      name: spec.name,
      objective: spec.goal,
      status: "draft",
      external_status: null,
      source: input.source ?? "panel",
      daily_budget: spec.daily_budget,
      currency: spec.currency,
      start_at: spec.start_at ? new Date(spec.start_at) : null,
      spec,
    } as any)
  )

  let created
  try {
    created = await provider.createCampaign(creds, account.external_id, spec)
  } catch (e: any) {
    await mk.updateAdsCampaigns({
      id: campaign.id,
      status: "error",
      meta: { error: e?.message ?? "platform create failed" },
    } as any)
    await mk.createAdsActionLogs({
      tenant_id: tenantId,
      actor: "merchant",
      action: "campaign.create_failed",
      level: "campaign",
      object_id: campaign.id,
      reason: e?.message ?? "The platform rejected the campaign",
    } as any)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      e?.message ?? "The platform rejected the campaign."
    )
  }

  // Persist the mirror. A failure here (e.g. a unique-index collision on the
  // external id) must never leak a raw DB error or leave a dangling draft —
  // the campaign EXISTS on the platform at this point, so record the ids on
  // the row as error state and tell the merchant something actionable.
  let updated: any
  let adset: any
  try {
    updated = first(
      await mk.updateAdsCampaigns({
        id: campaign.id,
        external_id: created.campaign_external_id,
        status: "paused",
        external_status: created.external_status,
        last_synced_at: new Date(),
      } as any)
    )
  } catch (e: any) {
    await mk.updateAdsCampaigns({
      id: campaign.id,
      status: "error",
      meta: {
        error: e?.message ?? "could not record the created campaign",
        external_id: created.campaign_external_id,
      },
    } as any)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The campaign could not be recorded — most likely a campaign with the same platform identity already exists. Give it a different name and try again."
    )
  }

  adset = first(
    await mk.createAdsAdsets({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      external_id: created.adset_external_id,
      name: `${spec.name} — ad set`,
      status: "paused",
      external_status: created.external_status,
      daily_budget: spec.daily_budget,
      targeting: { countries: spec.countries },
      optimization_goal: spec.goal,
      last_synced_at: new Date(),
    } as any)
  )

  await mk.createAdsAds({
    tenant_id: tenantId,
    adset_id: adset.id,
    campaign_id: campaign.id,
    external_id: created.ad_external_id,
    name: `${spec.name} — ad`,
    status: "paused",
    external_status: created.external_status,
    creative: {
      headline: spec.headline,
      primary_text: spec.primary_text,
      image_url: spec.image_url,
      link_url: spec.link_url,
      creative_external_id: created.creative_external_id,
    },
    last_synced_at: new Date(),
  } as any)

  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: input.source === "ai" ? "ai" : "merchant",
    action: "campaign.created",
    level: "campaign",
    object_id: campaign.id,
    external_id: created.campaign_external_id,
    reason: `Created "${spec.name}" (${spec.goal}, ${spec.currency ?? ""} ${spec.daily_budget}/day) — PAUSED until you launch it`,
    after: { status: "paused", daily_budget: spec.daily_budget },
  } as any)

  return updated ?? campaign
}

/** Look up a tenant's campaign row + its platform context, fail-closed. */
const campaignContext = async (mk: any, tenantId: string, campaignId: string) => {
  const campaign = first(
    await mk.listAdsCampaigns({ id: campaignId, tenant_id: tenantId })
  )
  if (!campaign) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "This campaign was not found."
    )
  }
  if (!campaign.external_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This campaign never made it to the platform (it is a draft or failed create)."
    )
  }
  const provider = getAdsProvider(campaign.platform)
  const connection = first(
    await mk.listAdsConnections({
      tenant_id: tenantId,
      platform: campaign.platform,
      status: "connected",
    })
  )
  const creds = connection ? openAdsConnectionCredentials(connection) : null
  if (!provider || !creds) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Your ${campaign.platform} connection has expired — please reconnect.`
    )
  }
  return { campaign, provider, creds }
}

/** Flip a campaign active/paused — the explicit go-live (or stop) action. */
export const setCampaignStatus = async (
  mk: any,
  tenantId: string,
  campaignId: string,
  status: "active" | "paused",
  actor: "merchant" | "ai" | "autopilot" = "merchant",
  reason?: string
): Promise<any> => {
  const { campaign, provider, creds } = await campaignContext(
    mk,
    tenantId,
    campaignId
  )
  await provider.setCampaignStatus(creds, campaign.external_id, status)
  const updated = first(
    await mk.updateAdsCampaigns({
      id: campaign.id,
      status,
      external_status: status === "active" ? "ACTIVE" : "PAUSED",
      last_synced_at: new Date(),
    } as any)
  )
  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor,
    action: status === "active" ? "campaign.activated" : "campaign.paused",
    level: "campaign",
    object_id: campaign.id,
    external_id: campaign.external_id,
    reason:
      reason ??
      (status === "active"
        ? `"${campaign.name}" is now live`
        : `"${campaign.name}" paused`),
    before: { status: campaign.status },
    after: { status },
  } as any)
  return updated
}

/** Change a campaign's daily budget (MAJOR units). */
export const setCampaignBudget = async (
  mk: any,
  tenantId: string,
  campaignId: string,
  dailyBudget: number,
  actor: "merchant" | "ai" | "autopilot" = "merchant",
  reason?: string
): Promise<any> => {
  if (!(Number(dailyBudget) > 0)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The daily budget must be greater than zero."
    )
  }
  const { campaign, provider, creds } = await campaignContext(
    mk,
    tenantId,
    campaignId
  )
  const adset = first(
    await mk.listAdsAdsets({ tenant_id: tenantId, campaign_id: campaign.id })
  )
  await provider.setCampaignBudget(
    creds,
    {
      campaign_external_id: campaign.external_id,
      adset_external_id: adset?.external_id ?? null,
    },
    Number(dailyBudget)
  )
  const updated = first(
    await mk.updateAdsCampaigns({
      id: campaign.id,
      daily_budget: Number(dailyBudget),
      last_synced_at: new Date(),
    } as any)
  )
  if (adset?.id) {
    await mk.updateAdsAdsets({
      id: adset.id,
      daily_budget: Number(dailyBudget),
    } as any)
  }
  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor,
    action: "campaign.budget_changed",
    level: "campaign",
    object_id: campaign.id,
    external_id: campaign.external_id,
    reason:
      reason ??
      `Daily budget for "${campaign.name}": ${campaign.daily_budget ?? "?"} -> ${dailyBudget}`,
    before: { daily_budget: campaign.daily_budget },
    after: { daily_budget: Number(dailyBudget) },
  } as any)
  return updated
}
