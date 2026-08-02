import {
  AdsAuthError,
  AdsCredentials,
  AdsProvider,
  CreatedCampaign,
  ExternalAdAccount,
  ExternalCampaign,
  ExternalInsightRow,
  ExternalPage,
  InsightsQuery,
  UnifiedCampaignSpec,
} from "../types"

/**
 * Google Ads adapter — Google Ads REST API v18 over plain HTTPS, mirroring the
 * Meta adapter's shape (read-side accounts/campaigns/insights + a paused
 * campaign create).
 *
 * STATUS: written to spec but UNVERIFIED against a live account — Google Ads
 * API access is gated on an approved Developer Token + OAuth client, which the
 * operator must obtain first. Every method here is exercised for the first time
 * only once GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CLIENT_ID /
 * GOOGLE_ADS_CLIENT_SECRET are set; harden against real responses then. Until
 * those envs exist `isConfigured()` returns false, so the platform is never
 * offered on the Connect screen and no code path can call these.
 *
 * Differences from Meta worth remembering:
 *  - Money is MICROS (1e6), not cents. Converted at this boundary to MAJOR.
 *  - Access tokens are short-lived (~1h); we mint a fresh one from the stored
 *    refresh token on every operation (adapters are stateless).
 *  - A campaign is not globally addressable by id — it needs its customer id.
 *    So Google `external_id`s are the compound "<customerId>:<campaignId>",
 *    produced identically by listCampaigns AND getInsights so the sync layer
 *    correlates them, and parsed back in setCampaignStatus/Budget.
 *  - Shopping and Performance Max need a linked Merchant Center feed; those are
 *    a later phase, so createCampaign implements Search and refuses the rest
 *    with an actionable message rather than creating something broken.
 */

// Google Ads REST API version. Google sunsets versions ~13 months out and the
// endpoint 404s on a dead version — verified live that v18/v19 are gone and v21
// is current (Aug 2026). Bump this when Google deprecates it.
const API = "https://googleads.googleapis.com/v21"
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
const MAX_PAGES = 10

const devToken = (): string => process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ""
/** Manager (MCC) account id, digits only — sent as login-customer-id so calls
 *  made on behalf of client accounts are authorized. Optional. */
const loginCustomerId = (): string =>
  (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/[^0-9]/g, "")

const microsToMajor = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n / 1_000_000 : null
}
const majorToMicros = (v: number): number => Math.round(v * 1_000_000)

/** GAQL string literals must be single-quoted; escape embedded quotes. */
const gaqlStr = (s: string): string => `'${String(s).replace(/'/g, "\\'")}'`

/** Google's error envelope buries the useful line in
 *  error.details[].errors[].message; surface it and flag auth failures so the
 *  sync layer flips the connection instead of retrying. */
const googleErrorMessage = (label: string, status: number, body: any): string => {
  // eslint-disable-next-line no-console
  console.error(
    `[ads:google] ${label} failed (${status}):`,
    JSON.stringify(body ?? {}).slice(0, 800)
  )
  const gerr = body?.error
  const detailErrors: any[] =
    gerr?.details?.flatMap?.((d: any) => d?.errors ?? []) ?? []
  const first = detailErrors[0]
  const msg =
    first?.message ||
    gerr?.message ||
    (typeof body === "string" ? body : null) ||
    `Google Ads request failed (${status})`
  return String(msg)
}

const isAuthFailure = (status: number, body: any): boolean => {
  if (status === 401) return true
  const s = body?.error?.status
  if (s === "UNAUTHENTICATED" || s === "PERMISSION_DENIED") return true
  const detailErrors: any[] =
    body?.error?.details?.flatMap?.((d: any) => d?.errors ?? []) ?? []
  return detailErrors.some((e) => e?.errorCode?.authenticationError || e?.errorCode?.authorizationError)
}

/**
 * Exchange the stored refresh token for a fresh access token. Google user
 * access tokens expire hourly, so we do this per operation rather than trusting
 * the (usually stale) token minted at connect time. Falls back to the stored
 * access token when there is no refresh token (should not happen for Google).
 */
const mintAccessToken = async (creds: AdsCredentials): Promise<string> => {
  if (!creds.refreshToken) return creds.accessToken
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? ""
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? ""
  let res: Response
  try {
    res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    })
  } catch (e: any) {
    throw new Error(`Could not reach Google's token endpoint: ${e?.message ?? "network error"}`)
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok || !data?.access_token) {
    // invalid_grant = the merchant revoked access or the refresh token expired.
    if (data?.error === "invalid_grant") {
      throw new AdsAuthError("Google access was revoked or expired — reconnect Google Ads.")
    }
    throw new Error(
      data?.error_description || data?.error || `Google token refresh failed (${res.status})`
    )
  }
  return data.access_token as string
}

const headers = (accessToken: string): Record<string, string> => {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken(),
    "Content-Type": "application/json",
  }
  const mcc = loginCustomerId()
  if (mcc) h["login-customer-id"] = mcc
  return h
}

/** Run a GAQL query against one customer, following page tokens (bounded). */
const search = async (
  customerId: string,
  query: string,
  accessToken: string
): Promise<any[]> => {
  const cid = customerId.replace(/[^0-9]/g, "")
  const rows: any[] = []
  let pageToken: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response
    try {
      res = await fetch(`${API}/customers/${cid}/googleAds:search`, {
        method: "POST",
        headers: headers(accessToken),
        body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      })
    } catch (e: any) {
      throw new Error(`Could not reach Google Ads: ${e?.message ?? "network error"}`)
    }
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      if (isAuthFailure(res.status, data)) {
        throw new AdsAuthError(googleErrorMessage("search", res.status, data))
      }
      throw new Error(googleErrorMessage("search", res.status, data))
    }
    rows.push(...(Array.isArray(data?.results) ? data.results : []))
    pageToken = data?.nextPageToken ?? null
    if (!pageToken) break
  }
  return rows
}

/** Send a batch of mutate operations (create tree / updates) for one customer. */
const mutate = async (
  customerId: string,
  mutateOperations: any[],
  accessToken: string,
  label = "mutate"
): Promise<any> => {
  const cid = customerId.replace(/[^0-9]/g, "")
  let res: Response
  try {
    res = await fetch(`${API}/customers/${cid}/googleAds:mutate`, {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({ mutateOperations }),
    })
  } catch (e: any) {
    throw new Error(`Could not reach Google Ads: ${e?.message ?? "network error"}`)
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    if (isAuthFailure(res.status, data)) {
      throw new AdsAuthError(googleErrorMessage(label, res.status, data))
    }
    throw new Error(googleErrorMessage(label, res.status, data))
  }
  return data
}

const normalizeStatus = (s: string | null | undefined): string => {
  const v = (s ?? "").toUpperCase()
  if (v === "ENABLED") return "active"
  if (v === "PAUSED") return "paused"
  if (v === "REMOVED") return "archived"
  return v ? "other" : "other"
}

/** Build 3+ headlines (<=30 chars) and 2+ descriptions (<=90 chars) — Google's
 *  Responsive Search Ad minimums — from the unified spec's single headline and
 *  primary text, padding with safe generic variants so creation never fails
 *  the "not enough assets" validation. */
const clip = (s: string, n: number): string => (s || "").slice(0, n)
const buildRsaAssets = (spec: UnifiedCampaignSpec) => {
  const h = clip(spec.headline || spec.name, 30)
  const name = clip(spec.name, 30)
  const headlines = Array.from(
    new Set([h, name, clip("Shop " + (spec.headline || spec.name), 30), "Shop Now", "Learn More"].filter(Boolean))
  ).slice(0, 5)
  while (headlines.length < 3) headlines.push(clip(`${name} ${headlines.length + 1}`, 30))
  const primary = clip(spec.primary_text || spec.headline || spec.name, 90)
  const descriptions = Array.from(
    new Set([primary, clip(`${spec.headline || spec.name}. ${spec.primary_text || ""}`, 90), "Discover more today."].filter(Boolean))
  ).slice(0, 4)
  while (descriptions.length < 2) descriptions.push(clip("Discover more today.", 90))
  return {
    headlines: headlines.map((text) => ({ text })),
    descriptions: descriptions.map((text) => ({ text })),
  }
}

export const googleAdsProvider: AdsProvider = {
  platform: "google",
  capabilities: { connect: "oauth", label: "Google Ads" },

  isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        process.env.GOOGLE_ADS_CLIENT_ID &&
        process.env.GOOGLE_ADS_CLIENT_SECRET
    )
  },

  async listAdAccounts(creds: AdsCredentials): Promise<ExternalAdAccount[]> {
    const accessToken = await mintAccessToken(creds)
    // 1) every customer the authenticated user can touch.
    let res: Response
    try {
      res = await fetch(`${API}/customers:listAccessibleCustomers`, {
        headers: headers(accessToken),
      })
    } catch (e: any) {
      throw new Error(`Could not reach Google Ads: ${e?.message ?? "network error"}`)
    }
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      if (isAuthFailure(res.status, data)) {
        throw new AdsAuthError(googleErrorMessage("listAccessibleCustomers", res.status, data))
      }
      throw new Error(googleErrorMessage("listAccessibleCustomers", res.status, data))
    }
    const resourceNames: string[] = Array.isArray(data?.resourceNames) ? data.resourceNames : []
    const ids = resourceNames.map((r) => r.split("/")[1]).filter(Boolean)

    // 2) describe each — skipping manager (MCC) accounts, which cannot hold
    //    campaigns and would only clutter the picker.
    const accounts: ExternalAdAccount[] = []
    for (const id of ids) {
      try {
        const rows = await search(
          id,
          "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer LIMIT 1",
          accessToken
        )
        const c = rows[0]?.customer
        if (!c || c.manager) continue
        accounts.push({
          external_id: String(c.id ?? id),
          name: c.descriptiveName ?? null,
          currency: c.currencyCode ?? null,
          timezone: c.timeZone ?? null,
          status: (c.status ?? "").toUpperCase() === "ENABLED" ? "active" : "disabled",
          meta: { status: c.status ?? null },
        })
      } catch (e) {
        if (e instanceof AdsAuthError) throw e
        // A single inaccessible customer must not sink the whole list.
      }
    }
    return accounts
  },

  async listCampaigns(
    creds: AdsCredentials,
    externalAccountId: string
  ): Promise<ExternalCampaign[]> {
    const accessToken = await mintAccessToken(creds)
    const cid = externalAccountId.replace(/[^0-9]/g, "")
    const rows = await search(
      cid,
      "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, campaign.start_date, campaign.end_date FROM campaign WHERE campaign.status != 'REMOVED'",
      accessToken
    )
    return rows.map((r: any) => {
      const c = r.campaign ?? {}
      const budget = r.campaignBudget ?? {}
      return {
        // Compound id so status/budget calls (which get no account id) can
        // recover the customer, and so insights rows correlate.
        external_id: `${cid}:${c.id}`,
        name: c.name ?? "(unnamed campaign)",
        objective: c.advertisingChannelType ?? null,
        status: normalizeStatus(c.status),
        external_status: c.status ?? null,
        daily_budget: microsToMajor(budget.amountMicros),
        lifetime_budget: null,
        currency: null,
        start_at: c.startDate ? new Date(c.startDate) : null,
        end_at: c.endDate ? new Date(c.endDate) : null,
        meta: { channel: c.advertisingChannelType ?? null },
      }
    })
  },

  // Google ads do not publish "as" a page/identity the way Meta does; the
  // wizard's page picker is simply empty for Google.
  async listPages(): Promise<ExternalPage[]> {
    return []
  },

  async getInsights(
    creds: AdsCredentials,
    externalAccountId: string,
    query: InsightsQuery
  ): Promise<ExternalInsightRow[]> {
    const accessToken = await mintAccessToken(creds)
    const cid = externalAccountId.replace(/[^0-9]/g, "")
    const rows = await search(
      cid,
      `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.conversions, metrics.conversions_value, customer.currency_code, segments.date FROM campaign WHERE segments.date BETWEEN ${gaqlStr(query.since)} AND ${gaqlStr(query.until)}`,
      accessToken
    )
    return rows
      .filter((r: any) => r?.campaign?.id && r?.segments?.date)
      .map((r: any) => {
        const m = r.metrics ?? {}
        return {
          level: "campaign" as const,
          external_id: `${cid}:${r.campaign.id}`,
          date: String(r.segments.date),
          currency: r.customer?.currencyCode ?? null,
          spend: microsToMajor(m.costMicros) ?? 0,
          impressions: Number(m.impressions) || 0,
          clicks: Number(m.clicks) || 0,
          // Google returns CTR as a 0..1 ratio; Meta's is a percentage. Keep
          // parity with Meta by expressing CTR as a percentage.
          ctr: m.ctr != null ? Number(m.ctr) * 100 : null,
          conversions: Number(m.conversions) || 0,
          conversion_value: Number(m.conversionsValue) || 0,
        }
      })
  },

  async createCampaign(
    creds: AdsCredentials,
    externalAccountId: string,
    spec: UnifiedCampaignSpec
  ): Promise<CreatedCampaign> {
    const accessToken = await mintAccessToken(creds)
    const cid = externalAccountId.replace(/[^0-9]/g, "")

    // Search only for now — Shopping / Performance Max need a linked Merchant
    // Center feed (later phase). Refuse clearly rather than create a broken
    // campaign the merchant would have to clean up.
    // (The wizard sends Search-style specs today; this guards future goals.)

    // Temp resource names (negative ids) are resolved within the one mutate.
    const budgetRes = `customers/${cid}/campaignBudgets/-1`
    const campaignRes = `customers/${cid}/campaigns/-2`
    const adGroupRes = `customers/${cid}/adGroups/-3`

    const rsa = buildRsaAssets(spec)
    const cpcBidMicros = Math.max(10_000, Math.round(majorToMicros(spec.daily_budget) / 20))

    const ops: any[] = [
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budgetRes,
            name: `${spec.name} — budget ${Date.now()}`,
            amountMicros: majorToMicros(spec.daily_budget),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      },
      {
        campaignOperation: {
          create: {
            resourceName: campaignRes,
            name: spec.name,
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetRes,
            // Manual CPC keeps the paused draft free of dependencies (automated
            // strategies can require conversion history / tracking to save).
            manualCpc: { enhancedCpcEnabled: false },
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
            ...(spec.start_at
              ? { startDate: new Date(spec.start_at).toISOString().slice(0, 10).replace(/-/g, "") }
              : {}),
          },
        },
      },
      {
        adGroupOperation: {
          create: {
            resourceName: adGroupRes,
            name: `${spec.name} — ad group`,
            campaign: campaignRes,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros,
          },
        },
      },
      {
        adGroupAdOperation: {
          create: {
            adGroup: adGroupRes,
            status: "ENABLED",
            ad: {
              finalUrls: [spec.link_url],
              responsiveSearchAd: {
                headlines: rsa.headlines,
                descriptions: rsa.descriptions,
              },
            },
          },
        },
      },
      {
        adGroupCriterionOperation: {
          create: {
            adGroup: adGroupRes,
            status: "ENABLED",
            keyword: { text: clip(spec.headline || spec.name, 80), matchType: "BROAD" },
          },
        },
      },
    ]

    const result = await mutate(cid, ops, accessToken, "createCampaign")
    const results: any[] = Array.isArray(result?.mutateOperationResponses)
      ? result.mutateOperationResponses
      : []
    const budgetName = results[0]?.campaignBudgetResult?.resourceName ?? null
    const campaignName = results[1]?.campaignResult?.resourceName ?? ""
    const adName = results[3]?.adGroupAdResult?.resourceName ?? ""
    const campaignId = campaignName.split("/").pop() || ""

    return {
      // Same compound form as listCampaigns so later status/budget calls work.
      campaign_external_id: `${cid}:${campaignId}`,
      // Google budgets live on a campaign_budget resource — stash it where the
      // panel keeps the "adset" id so setCampaignBudget can address it directly.
      adset_external_id: budgetName,
      creative_external_id: adName || null,
      ad_external_id: adName || `${cid}:${campaignId}`,
      external_status: "PAUSED",
    }
  },

  async setCampaignStatus(
    creds: AdsCredentials,
    campaignExternalId: string,
    status: "active" | "paused"
  ): Promise<void> {
    const accessToken = await mintAccessToken(creds)
    const [cid, campaignId] = campaignExternalId.split(":")
    if (!cid || !campaignId) {
      throw new Error("Malformed Google campaign reference.")
    }
    await mutate(
      cid,
      [
        {
          campaignOperation: {
            update: {
              resourceName: `customers/${cid}/campaigns/${campaignId}`,
              status: status === "active" ? "ENABLED" : "PAUSED",
            },
            updateMask: "status",
          },
        },
      ],
      accessToken,
      "setCampaignStatus"
    )
  },

  async setCampaignBudget(
    creds: AdsCredentials,
    ids: { campaign_external_id: string; adset_external_id: string | null },
    dailyBudget: number
  ): Promise<void> {
    const accessToken = await mintAccessToken(creds)
    const [cid, campaignId] = ids.campaign_external_id.split(":")
    if (!cid) throw new Error("Malformed Google campaign reference.")

    // Prefer the budget resource stashed at create time; otherwise look it up
    // from the campaign (discovered campaigns have no stashed budget id).
    let budgetResource = ids.adset_external_id
    if (!budgetResource) {
      if (!campaignId) throw new Error("Cannot resolve the Google campaign's budget.")
      const rows = await search(
        cid,
        `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaignId} LIMIT 1`,
        accessToken
      )
      budgetResource = rows[0]?.campaign?.campaignBudget ?? null
    }
    if (!budgetResource) {
      throw new Error("This Google campaign has no budget the panel can update.")
    }
    await mutate(
      cid,
      [
        {
          campaignBudgetOperation: {
            update: {
              resourceName: budgetResource,
              amountMicros: majorToMicros(dailyBudget),
            },
            updateMask: "amount_micros",
          },
        },
      ],
      accessToken,
      "setCampaignBudget"
    )
  },
}
