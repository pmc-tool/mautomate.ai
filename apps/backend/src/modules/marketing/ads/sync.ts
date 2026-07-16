import { AdsAuthError } from "./types"
import { getAdsProvider } from "./registry"
import { openAdsConnectionCredentials } from "./credentials"

/**
 * Ads mirror + insight sync, and the overview aggregation the dashboard reads.
 *
 * Everything here is tenant-scoped by explicit tenant_id filters (the caller
 * resolves the merchant). Sync is upsert-based and idempotent: campaigns match
 * on (tenant, platform, external_id); insight days match on (tenant, level,
 * external_id, date) — re-running a window refreshes rather than duplicates,
 * which also picks up Meta's late attribution restatements for recent days.
 *
 * The overview aggregates ONLY stored ads_insight rows. Empty tenants report
 * zeros — never fabricated numbers.
 */

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const dayString = (d: Date): string => d.toISOString().slice(0, 10)

const daysAgo = (n: number): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return dayString(d)
}

/** Flip a connection whose token the platform rejected — the UI then shows an
 *  honest "reconnect" state instead of silently stale data. */
const markConnectionExpired = async (mk: any, connection: any) => {
  try {
    await mk.updateAdsConnections({ id: connection.id, status: "expired" } as any)
  } catch {
    /* best-effort */
  }
}

/** Discover/refresh the ad accounts under a connection. Returns the rows. */
export const syncConnectionAccounts = async (
  mk: any,
  connection: any
): Promise<any[]> => {
  const provider = getAdsProvider(connection.platform)
  const creds = openAdsConnectionCredentials(connection)
  if (!provider || !creds) return []

  let remote
  try {
    remote = await provider.listAdAccounts(creds)
  } catch (e) {
    if (e instanceof AdsAuthError) await markConnectionExpired(mk, connection)
    throw e
  }

  const out: any[] = []
  for (const acct of remote) {
    const existing = first(
      await mk.listAdsAccounts({
        tenant_id: connection.tenant_id,
        platform: connection.platform,
        external_id: acct.external_id,
      })
    )
    const payload = {
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      platform: connection.platform,
      external_id: acct.external_id,
      name: acct.name,
      currency: acct.currency,
      timezone: acct.timezone,
      status: acct.status,
      last_synced_at: new Date(),
      meta: acct.meta ?? null,
    }
    if (existing?.id) {
      out.push(
        first(await mk.updateAdsAccounts({ id: existing.id, ...payload } as any))
      )
    } else {
      // A tenant's very first (and only) ad account is auto-selected so the
      // one-account common case needs no extra click.
      const total = await mk.listAdsAccounts(
        { tenant_id: connection.tenant_id },
        { take: 2 }
      )
      out.push(
        first(
          await mk.createAdsAccounts({
            ...payload,
            selected: remote.length === 1 && (total ?? []).length === 0,
          } as any)
        )
      )
    }
  }
  return out
}

/** Mirror an account's campaigns. Panel/AI-created rows keep their source. */
export const syncAccountCampaigns = async (
  mk: any,
  connection: any,
  account: any
): Promise<number> => {
  const provider = getAdsProvider(account.platform)
  const creds = openAdsConnectionCredentials(connection)
  if (!provider || !creds) return 0

  let remote
  try {
    remote = await provider.listCampaigns(creds, account.external_id)
  } catch (e) {
    if (e instanceof AdsAuthError) await markConnectionExpired(mk, connection)
    throw e
  }

  for (const cmp of remote) {
    const existing = first(
      await mk.listAdsCampaigns({
        tenant_id: account.tenant_id,
        platform: account.platform,
        external_id: cmp.external_id,
      })
    )
    const payload = {
      tenant_id: account.tenant_id,
      account_id: account.id,
      platform: account.platform,
      external_id: cmp.external_id,
      name: cmp.name,
      objective: cmp.objective,
      status: cmp.status,
      external_status: cmp.external_status,
      daily_budget: cmp.daily_budget,
      lifetime_budget: cmp.lifetime_budget,
      currency: cmp.currency ?? account.currency ?? null,
      start_at: cmp.start_at,
      end_at: cmp.end_at,
      last_synced_at: new Date(),
    }
    if (existing?.id) {
      await mk.updateAdsCampaigns({ id: existing.id, ...payload } as any)
    } else {
      await mk.createAdsCampaigns({ ...payload, source: "imported" } as any)
    }
  }
  return remote.length
}

/** Pull daily campaign-level insight rows for a window and upsert them. */
export const syncAccountInsights = async (
  mk: any,
  connection: any,
  account: any,
  opts: { days?: number } = {}
): Promise<number> => {
  const provider = getAdsProvider(account.platform)
  const creds = openAdsConnectionCredentials(connection)
  if (!provider || !creds) return 0

  // First sync backfills a month; steady-state refreshes a rolling week so
  // late-arriving attribution updates recent days.
  const days = opts.days ?? (account.last_synced_at ? 7 : 30)
  const query = { since: daysAgo(days), until: dayString(new Date()) }

  let rows
  try {
    rows = await provider.getInsights(creds, account.external_id, query)
  } catch (e) {
    if (e instanceof AdsAuthError) await markConnectionExpired(mk, connection)
    throw e
  }

  for (const row of rows) {
    const date = new Date(`${row.date}T00:00:00Z`)
    const existing = first(
      await mk.listAdsInsights({
        tenant_id: account.tenant_id,
        level: row.level,
        external_id: row.external_id,
        date,
      })
    )
    const payload = {
      tenant_id: account.tenant_id,
      account_id: account.id,
      level: row.level,
      external_id: row.external_id,
      date,
      currency: row.currency,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      conversions: row.conversions,
      conversion_value: row.conversion_value,
    }
    if (existing?.id) {
      await mk.updateAdsInsights({ id: existing.id, ...payload } as any)
    } else {
      await mk.createAdsInsights(payload as any)
    }
  }

  await mk.updateAdsAccounts({
    id: account.id,
    last_synced_at: new Date(),
  } as any)
  return rows.length
}

export type AdsSyncSummary = {
  connections: number
  accounts: number
  campaigns: number
  insight_rows: number
  errors: string[]
}

/**
 * Full sync for one tenant: refresh accounts under every connected
 * connection, then campaigns + insights for every selected active account.
 * Per-account failures are collected, not fatal — one bad account must not
 * starve the rest.
 */
export const runAdsSyncForTenant = async (
  mk: any,
  tenantId: string
): Promise<AdsSyncSummary> => {
  const summary: AdsSyncSummary = {
    connections: 0,
    accounts: 0,
    campaigns: 0,
    insight_rows: 0,
    errors: [],
  }

  const connections = await mk.listAdsConnections(
    { tenant_id: tenantId, status: "connected" },
    { take: 50 }
  )

  for (const connection of connections ?? []) {
    summary.connections += 1
    try {
      const accounts = await syncConnectionAccounts(mk, connection)
      summary.accounts += accounts.length
    } catch (e: any) {
      summary.errors.push(`accounts(${connection.platform}): ${e?.message}`)
      continue
    }

    const selected = await mk.listAdsAccounts(
      {
        tenant_id: tenantId,
        connection_id: connection.id,
        selected: true,
        status: "active",
      },
      { take: 100 }
    )
    for (const account of selected ?? []) {
      try {
        summary.campaigns += await syncAccountCampaigns(mk, connection, account)
        summary.insight_rows += await syncAccountInsights(
          mk,
          connection,
          account
        )
      } catch (e: any) {
        summary.errors.push(
          `account(${account.external_id}): ${e?.message ?? "sync failed"}`
        )
      }
    }
  }

  return summary
}

export type AdsOverview = {
  days: number
  connections: any[]
  accounts: any[]
  totals: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversion_value: number
    roas: number | null
    currency: string | null
  }
  campaigns: any[]
  daily: { date: string; spend: number; conversions: number }[]
  last_synced_at: string | null
}

/** Aggregate stored insight rows into the dashboard payload. */
export const getAdsOverview = async (
  mk: any,
  tenantId: string,
  opts: { days?: number } = {}
): Promise<AdsOverview> => {
  const days = Math.min(Math.max(opts.days ?? 30, 1), 90)
  const sinceDate = new Date(`${daysAgo(days)}T00:00:00Z`)

  const [connections, accounts, campaigns] = await Promise.all([
    mk.listAdsConnections({ tenant_id: tenantId }, { take: 20 }),
    mk.listAdsAccounts({ tenant_id: tenantId }, { take: 200 }),
    mk.listAdsCampaigns(
      { tenant_id: tenantId },
      { take: 500, order: { updated_at: "DESC" } }
    ),
  ])

  const insights = await mk.listAdsInsights(
    { tenant_id: tenantId, date: { $gte: sinceDate } },
    { take: 20000 }
  )

  const totals = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversion_value: 0,
    roas: null as number | null,
    currency: null as string | null,
  }
  const byCampaign = new Map<string, any>()
  const byDay = new Map<string, { spend: number; conversions: number }>()

  for (const row of insights ?? []) {
    totals.spend += Number(row.spend) || 0
    totals.impressions += Number(row.impressions) || 0
    totals.clicks += Number(row.clicks) || 0
    totals.conversions += Number(row.conversions) || 0
    totals.conversion_value += Number(row.conversion_value) || 0
    if (!totals.currency && row.currency) totals.currency = row.currency

    if (row.level === "campaign") {
      const agg = byCampaign.get(row.external_id) ?? {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
      }
      agg.spend += Number(row.spend) || 0
      agg.impressions += Number(row.impressions) || 0
      agg.clicks += Number(row.clicks) || 0
      agg.conversions += Number(row.conversions) || 0
      agg.conversion_value += Number(row.conversion_value) || 0
      byCampaign.set(row.external_id, agg)
    }

    const day = dayString(new Date(row.date))
    const d = byDay.get(day) ?? { spend: 0, conversions: 0 }
    d.spend += Number(row.spend) || 0
    d.conversions += Number(row.conversions) || 0
    byDay.set(day, d)
  }

  if (totals.spend > 0 && totals.conversion_value > 0) {
    totals.roas = Math.round((totals.conversion_value / totals.spend) * 100) / 100
  }

  const campaignRows = (campaigns ?? []).map((c: any) => {
    const agg = (c.external_id && byCampaign.get(c.external_id)) || null
    return {
      id: c.id,
      external_id: c.external_id,
      name: c.name,
      platform: c.platform,
      objective: c.objective,
      status: c.status,
      source: c.source,
      daily_budget: c.daily_budget,
      lifetime_budget: c.lifetime_budget,
      currency: c.currency,
      spend: agg ? Math.round(agg.spend * 100) / 100 : 0,
      impressions: agg?.impressions ?? 0,
      clicks: agg?.clicks ?? 0,
      conversions: agg?.conversions ?? 0,
      conversion_value: agg
        ? Math.round(agg.conversion_value * 100) / 100
        : 0,
      last_synced_at: c.last_synced_at,
    }
  })

  const lastSynced = (accounts ?? [])
    .map((a: any) => a.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop()

  return {
    days,
    connections: (connections ?? []).map((c: any) => ({
      id: c.id,
      platform: c.platform,
      display_name: c.display_name,
      status: c.status,
      expires_at: c.expires_at,
      created_at: c.created_at,
    })),
    accounts: (accounts ?? []).map((a: any) => ({
      id: a.id,
      connection_id: a.connection_id,
      platform: a.platform,
      external_id: a.external_id,
      name: a.name,
      currency: a.currency,
      status: a.status,
      selected: a.selected,
      last_synced_at: a.last_synced_at,
    })),
    totals: {
      ...totals,
      spend: Math.round(totals.spend * 100) / 100,
      conversion_value: Math.round(totals.conversion_value * 100) / 100,
    },
    campaigns: campaignRows,
    daily: Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        spend: Math.round(v.spend * 100) / 100,
        conversions: v.conversions,
      })),
    last_synced_at: lastSynced ? new Date(lastSynced).toISOString() : null,
  }
}
