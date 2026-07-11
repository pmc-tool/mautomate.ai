/**
 * Marketing → Analytics
 *
 * An honest performance dashboard: publishing throughput, inbox activity, the
 * content pipeline, and content->sales attribution — computed from REAL data by
 * GET /admin/marketing/analytics. Sections that need external signals we do not
 * yet capture (engagement, attribution) render tasteful empty states instead of
 * fabricating numbers.
 *
 * Self-contained by design: inline fetch helper, inline types, inline SVG
 * charts (no chart library, CSP-safe).
 */

import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ChartActivity,
  ChartBar,
  ChatBubbleLeftRight,
  CheckCircleSolid,
  CursorArrowRays,
  DocumentText,
  Newspaper,
  PaperPlane,
  ShoppingBag,
  Sparkles,
  XCircle,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  clx,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { EmptyState, PageHeader, StatTile } from "../_components/ui-kit"
import { BrandGlyph } from "../_components/brand-icons"

// ---------------------------------------------------------------------------
// Types (inline — this screen stays self-contained)
// ---------------------------------------------------------------------------

type DayPoint = { date: string; count: number }

type PlatformRow = {
  platform: string
  published: number
  failed: number
  success_rate: number
}

type Dashboard = {
  window: { since: string; until: string }
  has_activity: boolean
  publishing: {
    published: number
    failed: number
    scheduled: number
    pending: number
    publishing: number
    success_rate: number
    recent_published: number
    by_platform: PlatformRow[]
  }
  content: {
    posts_total: number
    posts_by_status: Record<string, number>
    blog_articles_total: number
    blog_articles_by_status: Record<string, number>
    blog_articles_published: number
    campaigns_total: number
  }
  inbox: {
    conversations_total: number
    by_status: Record<string, number>
    by_channel: Record<string, number>
    messages_inbound: number
    messages_outbound: number
    avg_first_response_minutes: number | null
  }
  engagement: {
    has_data: boolean
    rows: number
    totals: Record<string, number>
  }
  attribution: {
    attributed_orders: number
    attributed_revenue: number
    total_orders: number
    total_revenue: number
    currency_code: string | null
    has_data: boolean
    note: string
  }
  timeseries: {
    published_per_day: DayPoint[]
    messages_per_day: DayPoint[]
  }
}

// ---------------------------------------------------------------------------
// Fetch helper — credentials included so the admin session cookie rides along
// ---------------------------------------------------------------------------

const api = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.message || body?.error || ""
    } catch (_e) {
      // no JSON body — fall through with status
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
]

const pct = (v: number): string => `${Math.round((v ?? 0) * 100)}%`

const fmtInt = (v: number): string => new Intl.NumberFormat().format(v ?? 0)

const fmtMoney = (v: number, currency: string | null): string => {
  const amount = v ?? 0
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(amount)
    } catch (_e) {
      // unknown currency code — fall through
    }
  }
  return fmtInt(Math.round(amount))
}

const shortDate = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const titleize = (s: string): string =>
  s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const Panel = ({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon?: React.ComponentType<any>
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <div className="flex flex-col rounded-lg border border-ui-border-base bg-ui-bg-base">
    <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-3">
      <div className="flex items-center gap-x-2">
        {Icon ? <Icon className="text-ui-fg-subtle" /> : null}
        <Heading level="h3" className="text-ui-fg-base">
          {title}
        </Heading>
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
)

/**
 * Inline SVG area sparkline with a highlighted latest point + light axis labels.
 * No external chart library — CSP-safe.
 */
const Sparkline = ({
  points,
  color = "rgb(59,130,246)",
}: {
  points: DayPoint[]
  color?: string
}) => {
  const width = 640
  const height = 140
  const padX = 8
  const padY = 12
  const data = points.length ? points : [{ date: "", count: 0 }]
  const max = Math.max(1, ...data.map((p) => p.count))
  const n = data.length
  const stepX = n > 1 ? (width - padX * 2) / (n - 1) : 0
  const yFor = (c: number) =>
    height - padY - (c / max) * (height - padY * 2)
  const xFor = (i: number) => padX + i * stepX

  const linePts = data.map((p, i) => `${xFor(i)},${yFor(p.count)}`)
  const areaPath =
    `M ${xFor(0)},${height - padY} ` +
    data.map((p, i) => `L ${xFor(i)},${yFor(p.count)}`).join(" ") +
    ` L ${xFor(n - 1)},${height - padY} Z`

  const last = data[n - 1]
  const total = data.reduce((a, b) => a + b.count, 0)
  const gradId = useMemo(
    () => `spark-${Math.random().toString(36).slice(2, 8)}`,
    []
  )

  return (
    <div className="flex flex-col gap-y-2">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-[140px] w-full min-w-[320px]"
          role="img"
          aria-label={`Time series, ${total} total`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* baseline */}
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            strokeOpacity="0.12"
          />
          <path d={areaPath} fill={`url(#${gradId})`} />
          <polyline
            points={linePts.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* emphasized latest point */}
          <circle
            cx={xFor(n - 1)}
            cy={yFor(last.count)}
            r="4"
            fill={color}
            stroke="var(--bg-base, #fff)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between px-1">
        <Text size="xsmall" className="text-ui-fg-muted">
          {data[0]?.date ? shortDate(data[0].date) : ""}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          peak {fmtInt(max)}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          {last?.date ? shortDate(last.date) : ""}
        </Text>
      </div>
    </div>
  )
}

const BreakdownRow = ({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) => (
  <div className="flex items-center gap-x-3">
    <div className="w-28 shrink-0">
      <Text size="small" className="text-ui-fg-subtle">
        {titleize(label)}
      </Text>
    </div>
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ui-bg-subtle">
      <div
        className="h-full rounded-full bg-ui-fg-interactive"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
    <div className="w-10 shrink-0 text-right">
      <Text size="small" className="text-ui-fg-base">
        {fmtInt(value)}
      </Text>
    </div>
  </div>
)

const SkeletonTile = () => (
  <div className="h-[104px] animate-pulse rounded-lg border border-ui-border-base bg-ui-bg-subtle" />
)

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AnalyticsPage = () => {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const since = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString()
      const d = await api<Dashboard>(
        `/admin/marketing/analytics?since=${encodeURIComponent(since)}`
      )
      setData(d)
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const pub = data?.publishing
  const inbox = data?.inbox
  const content = data?.content
  const attr = data?.attribution
  const eng = data?.engagement

  const platformMax = useMemo(() => {
    if (!pub?.by_platform?.length) {
      return 1
    }
    return Math.max(
      1,
      ...pub.by_platform.map((p) => p.published + p.failed)
    )
  }, [pub])

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={ChartBar}
          accent="teal"
          title="Analytics"
          subtitle="Publishing throughput, inbox activity, and content-to-sales attribution — measured from real data."
          actions={
            <>
              <div className="flex items-center gap-x-0.5 rounded-lg bg-ui-bg-subtle p-0.5">
                {RANGES.map((r) => (
                  <Button
                    key={r.days}
                    size="small"
                    variant={days === r.days ? "primary" : "transparent"}
                    onClick={() => setDays(r.days)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
              <Button
                size="small"
                variant="transparent"
                onClick={load}
                disabled={loading}
              >
                <ArrowPath />
                Refresh
              </Button>
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-y-6 p-6">
        {/* Error */}
        {error ? (
          <div className="rounded-xl border border-ui-border-error bg-ui-bg-base">
            <EmptyState
              icon={XCircle}
              accent="rose"
              title="Could not load analytics"
              description={error}
              action={
                <Button size="small" variant="secondary" onClick={load}>
                  <ArrowPath />
                  Retry
                </Button>
              }
            />
          </div>
        ) : null}

        {/* Loading skeletons */}
        {loading && !data ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTile key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-lg border border-ui-border-base bg-ui-bg-subtle" />
              <div className="h-64 animate-pulse rounded-lg border border-ui-border-base bg-ui-bg-subtle" />
            </div>
          </>
        ) : null}

        {/* Global empty state */}
        {!loading && !error && data && !data.has_activity ? (
          <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
            <EmptyState
              icon={Sparkles}
              accent="teal"
              title="Start publishing to see analytics"
              description="No marketing activity yet in this window. Once you publish posts, run campaigns, or receive inbox messages, this dashboard fills in with real throughput, engagement, and attribution."
            />
          </div>
        ) : null}

        {/* Dashboard */}
        {!error && data && data.has_activity ? (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatTile
                icon={PaperPlane}
                accent="violet"
                label="Published posts"
                value={fmtInt(pub?.published ?? 0)}
                sub={`${fmtInt(pub?.recent_published ?? 0)} in last 7d`}
              />
              <StatTile
                icon={CheckCircleSolid}
                accent="green"
                label="Publish success"
                value={pct(pub?.success_rate ?? 0)}
                sub={`${fmtInt(pub?.failed ?? 0)} failed`}
              />
              <StatTile
                icon={ChatBubbleLeftRight}
                accent="blue"
                label="Open conversations"
                value={fmtInt(inbox?.by_status?.open ?? 0)}
                sub={`${fmtInt(inbox?.conversations_total ?? 0)} total`}
              />
              <StatTile
                icon={ChartActivity}
                accent="teal"
                label="Messages"
                value={fmtInt(
                  (inbox?.messages_inbound ?? 0) +
                    (inbox?.messages_outbound ?? 0)
                )}
                sub={`${fmtInt(inbox?.messages_inbound ?? 0)} in / ${fmtInt(
                  inbox?.messages_outbound ?? 0
                )} out`}
              />
              <StatTile
                icon={ShoppingBag}
                accent="amber"
                label="Attributed revenue"
                value={
                  attr?.has_data
                    ? fmtMoney(attr.attributed_revenue, attr.currency_code)
                    : "—"
                }
                sub={
                  attr?.has_data
                    ? `${fmtInt(attr.attributed_orders)} orders`
                    : "no tagged orders"
                }
              />
              <StatTile
                icon={Newspaper}
                accent="slate"
                label="Blog published"
                value={fmtInt(content?.blog_articles_published ?? 0)}
                sub={`${fmtInt(content?.blog_articles_total ?? 0)} articles`}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Published posts / day" icon={ChartBar}>
                {(pub?.published ?? 0) > 0 ? (
                  <Sparkline
                    points={data.timeseries.published_per_day}
                    color="rgb(59,130,246)"
                  />
                ) : (
                  <EmptyState
                    icon={ChartBar}
                    title="No posts published yet"
                    description="Publish posts in this window to see daily throughput."
                  />
                )}
              </Panel>
              <Panel title="Messages / day" icon={ChartActivity}>
                {(inbox?.messages_inbound ?? 0) +
                  (inbox?.messages_outbound ?? 0) >
                0 ? (
                  <Sparkline
                    points={data.timeseries.messages_per_day}
                    color="rgb(16,185,129)"
                  />
                ) : (
                  <EmptyState
                    icon={ChartActivity}
                    title="No inbox messages yet"
                    description="Inbound and outbound messages appear here as your inbox fills up."
                  />
                )}
              </Panel>
            </div>

            {/* Publishing by platform + Inbox */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Publishing by platform" icon={PaperPlane}>
                {pub?.by_platform?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[360px] text-left">
                      <thead>
                        <tr className="text-ui-fg-muted">
                          <th className="pb-2 font-normal">
                            <Text size="xsmall">Platform</Text>
                          </th>
                          <th className="pb-2 text-right font-normal">
                            <Text size="xsmall">Published</Text>
                          </th>
                          <th className="pb-2 text-right font-normal">
                            <Text size="xsmall">Failed</Text>
                          </th>
                          <th className="pb-2 text-right font-normal">
                            <Text size="xsmall">Success</Text>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pub.by_platform.map((p) => (
                          <tr
                            key={p.platform}
                            className="border-t border-ui-border-base"
                          >
                            <td className="py-2">
                              <div className="flex items-center gap-x-2">
                                <BrandGlyph platform={p.platform} size={16} />
                                <div className="h-1.5 flex-1 min-w-[60px] overflow-hidden rounded-full bg-ui-bg-subtle">
                                  <div
                                    className="h-full rounded-full bg-ui-fg-interactive"
                                    style={{
                                      width: `${
                                        platformMax > 0
                                          ? ((p.published + p.failed) /
                                              platformMax) *
                                            100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                                <Text
                                  size="small"
                                  className="capitalize text-ui-fg-base"
                                >
                                  {p.platform}
                                </Text>
                              </div>
                            </td>
                            <td className="py-2 text-right">
                              <Text size="small">{fmtInt(p.published)}</Text>
                            </td>
                            <td className="py-2 text-right">
                              <Text
                                size="small"
                                className={clx(
                                  p.failed > 0 && "text-ui-fg-error"
                                )}
                              >
                                {fmtInt(p.failed)}
                              </Text>
                            </td>
                            <td className="py-2 text-right">
                              <Badge
                                size="2xsmall"
                                color={
                                  p.success_rate >= 0.9
                                    ? "green"
                                    : p.success_rate >= 0.5
                                    ? "orange"
                                    : "red"
                                }
                              >
                                {pct(p.success_rate)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={PaperPlane}
                    title="No publishing activity"
                    description="Nothing has been published or failed in this window yet."
                  />
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ui-border-base pt-4">
                  <Badge size="2xsmall" color="blue">
                    {fmtInt(pub?.scheduled ?? 0)} scheduled
                  </Badge>
                  <Badge size="2xsmall" color="orange">
                    {fmtInt(pub?.pending ?? 0)} pending
                  </Badge>
                  <Badge size="2xsmall" color="purple">
                    {fmtInt(pub?.publishing ?? 0)} publishing
                  </Badge>
                </div>
              </Panel>

              <Panel title="Inbox" icon={ChatBubbleLeftRight}>
                <div className="flex flex-col gap-y-4">
                  <div>
                    <Text
                      size="xsmall"
                      className="mb-2 uppercase text-ui-fg-muted"
                    >
                      By status
                    </Text>
                    <div className="flex flex-col gap-y-2">
                      {["open", "snoozed", "closed"].map((s) => (
                        <BreakdownRow
                          key={s}
                          label={s}
                          value={inbox?.by_status?.[s] ?? 0}
                          max={inbox?.conversations_total ?? 1}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Text
                      size="xsmall"
                      className="mb-2 uppercase text-ui-fg-muted"
                    >
                      By channel
                    </Text>
                    {inbox && Object.keys(inbox.by_channel).length ? (
                      <div className="flex flex-col gap-y-2">
                        {Object.entries(inbox.by_channel)
                          .sort((a, b) => b[1] - a[1])
                          .map(([ch, v]) => (
                            <BreakdownRow
                              key={ch}
                              label={ch}
                              value={v}
                              max={inbox.conversations_total || 1}
                            />
                          ))}
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-muted">
                        No conversations yet.
                      </Text>
                    )}
                  </div>
                  {inbox?.avg_first_response_minutes != null ? (
                    <div className="flex items-center gap-x-2 border-t border-ui-border-base pt-3">
                      <Text size="small" className="text-ui-fg-subtle">
                        Avg. first response (proxy)
                      </Text>
                      <Badge size="2xsmall" color="grey">
                        {fmtInt(inbox.avg_first_response_minutes)} min
                      </Badge>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>

            {/* Engagement + Attribution */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Engagement" icon={CursorArrowRays}>
                {eng?.has_data ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(
                      [
                        ["impressions", "Impressions"],
                        ["reach", "Reach"],
                        ["clicks", "Clicks"],
                        ["conversions", "Conversions"],
                      ] as const
                    ).map(([k, label]) => (
                      <div
                        key={k}
                        className="flex flex-col gap-y-1 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3"
                      >
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {label}
                        </Text>
                        <Text className="text-lg font-semibold text-ui-fg-base">
                          {fmtInt(eng.totals[k] ?? 0)}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CursorArrowRays}
                    title="Connect platform insights"
                    description="Engagement metrics (impressions, reach, clicks, conversions) populate once platform insights are connected and readings are ingested. Nothing is estimated here."
                  />
                )}
              </Panel>

              <Panel title="Attribution" icon={ShoppingBag}>
                <div className="flex flex-col gap-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-y-1 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text size="xsmall" className="text-ui-fg-muted">
                        Attributed revenue
                      </Text>
                      <Text className="text-lg font-semibold text-ui-fg-base">
                        {attr?.has_data
                          ? fmtMoney(
                              attr.attributed_revenue,
                              attr.currency_code
                            )
                          : "—"}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {fmtInt(attr?.attributed_orders ?? 0)} tagged orders
                      </Text>
                    </div>
                    <div className="flex flex-col gap-y-1 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text size="xsmall" className="text-ui-fg-muted">
                        Store revenue (window)
                      </Text>
                      <Text className="text-lg font-semibold text-ui-fg-base">
                        {fmtMoney(
                          attr?.total_revenue ?? 0,
                          attr?.currency_code ?? null
                        )}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {fmtInt(attr?.total_orders ?? 0)} orders total
                      </Text>
                    </div>
                  </div>
                  {!attr?.has_data && attr?.note ? (
                    <div className="rounded-lg border border-dashed border-ui-border-strong bg-ui-bg-subtle p-3">
                      <Text size="small" className="text-ui-fg-subtle">
                        {attr.note}
                      </Text>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>

            {/* Content pipeline */}
            <Panel title="Content pipeline" icon={DocumentText}>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-y-1">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Posts
                  </Text>
                  <Text className="text-lg font-semibold text-ui-fg-base">
                    {fmtInt(content?.posts_total ?? 0)}
                  </Text>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(content?.posts_by_status ?? {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([s, v]) => (
                        <Badge key={s} size="2xsmall" color="grey">
                          {titleize(s)} {fmtInt(v)}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Blog articles
                  </Text>
                  <Text className="text-lg font-semibold text-ui-fg-base">
                    {fmtInt(content?.blog_articles_total ?? 0)}
                  </Text>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(content?.blog_articles_by_status ?? {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([s, v]) => (
                        <Badge key={s} size="2xsmall" color="grey">
                          {titleize(s)} {fmtInt(v)}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Campaigns
                  </Text>
                  <Text className="text-lg font-semibold text-ui-fg-base">
                    {fmtInt(content?.campaigns_total ?? 0)}
                  </Text>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Scheduled + pending
                  </Text>
                  <Text className="text-lg font-semibold text-ui-fg-base">
                    {fmtInt(
                      (pub?.scheduled ?? 0) + (pub?.pending ?? 0)
                    )}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    in the publish queue
                  </Text>
                </div>
              </div>
            </Panel>

            <Text size="xsmall" className="text-ui-fg-muted">
              Window: {shortDate(data.window.since)} –{" "}
              {shortDate(data.window.until)}. Engagement and attribution show
              empty states where the underlying signals are not yet captured —
              no numbers are estimated.
            </Text>
          </>
        ) : null}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
