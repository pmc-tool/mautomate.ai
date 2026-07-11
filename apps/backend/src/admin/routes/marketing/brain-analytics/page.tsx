/**
 * Marketing — Brain Analytics.
 *
 * The Marketing Brain dashboard: one honest, at-a-glance view of everything the
 * marketing engine is actually doing — email engagement, cart recovery,
 * journeys, audience, and revenue attribution — computed from REAL data over a
 * rolling window. Self-contained (inline fetch + types), built on the shared
 * marketing ui-kit so it matches the rest of the suite.
 *
 * Honesty rules mirror the API: engagement + attribution panels are empty-state
 * gated on their `has_data` flags, so we never dress up fabricated zeros as real
 * metrics. All charts are CSP-safe inline SVG (no chart library).
 *
 * API: GET /admin/marketing/brain-analytics?days=7|30|90
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ChartBar,
  Envelope,
  Eye,
  CursorArrowRays,
  ShoppingCart,
  CurrencyDollar,
  RocketLaunch,
  UserGroup,
  Tag,
  ChartActivity,
} from "@medusajs/icons"
import { Button, Container, Text, clx } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ACCENTS,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
  StatusDot,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Types (mirror the API response)
 * ------------------------------------------------------------------ */

type DayPoint = { date: string; count: number }

type BrainAnalytics = {
  window: { days: number; since: string; until: string }
  generated_at: string
  email: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    suppressed_total: number
    open_rate: number
    click_rate: number
    click_to_open: number
    has_data: boolean
  }
  recovery: {
    carts_detected: number
    emailed: number
    recovered: number
    recovered_revenue: number
    recovery_rate: number
    has_data: boolean
  }
  journeys: {
    total: number
    active_journeys: number
    enrollments: {
      active: number
      completed: number
      failed: number
      total: number
    }
    completion_rate: number
    has_data: boolean
  }
  audience: {
    total_contacts: number
    subscribed: number
    segments: number
    segment_members: number
    has_data: boolean
  }
  attribution: {
    attributed_orders: number
    attributed_revenue: number
    total_orders: number
    total_revenue: number
    has_data: boolean
  }
  timeseries: {
    emails_sent_per_day: DayPoint[]
    recovered_per_day: DayPoint[]
  }
}

/* ------------------------------------------------------------------ *
 * Fetch helper
 * ------------------------------------------------------------------ */

const api = async <T = any,>(path: string): Promise<T> => {
  const res = await fetch(`/admin/marketing/brain-analytics${path}`, {
    credentials: "include",
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      (payload as any)?.message ||
      (payload as any)?.error ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
]

const nf = new Intl.NumberFormat("en-US")

const fmtNum = (v?: number | null): string =>
  Number.isFinite(v ?? NaN) ? nf.format(v as number) : "—"

const fmtMoney = (
  amount?: number | null,
  currency?: string | null
): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—"
  }
  const code = (currency ?? "usd").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toFixed(0)} ${code}`
  }
}

const pct = (v?: number | null): string =>
  Number.isFinite(v ?? NaN) ? `${Math.round((v as number) * 100)}%` : "—"

const fmtDay = (iso?: string | null): string => {
  if (!iso) {
    return ""
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const sum = (points: DayPoint[]): number =>
  points.reduce((s, p) => s + (Number(p.count) || 0), 0)

/* ------------------------------------------------------------------ *
 * Segmented date-range control
 * ------------------------------------------------------------------ */

const RangeControl = ({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) => (
  <div className="inline-flex overflow-hidden rounded-lg border border-ui-border-base">
    {RANGES.map((r, i) => {
      const active = r.value === value
      return (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r.value)}
          className={clx(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            i > 0 && "border-l border-ui-border-base",
            active
              ? "bg-ui-bg-base text-ui-fg-base"
              : "bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-subtle",
            disabled && "opacity-60"
          )}
        >
          {r.label}
        </button>
      )
    })}
  </div>
)

/* ------------------------------------------------------------------ *
 * Panel shell
 * ------------------------------------------------------------------ */

const Panel = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={clx(
      "rounded-xl border border-ui-border-base bg-ui-bg-base p-4",
      className
    )}
  >
    {children}
  </div>
)

/* ------------------------------------------------------------------ *
 * Horizontal funnel row
 * ------------------------------------------------------------------ */

const FunnelRow = ({
  label,
  value,
  fraction,
  rate,
  accent,
}: {
  label: string
  value: number
  fraction: number
  rate?: string
  accent: string
}) => {
  const width = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className="flex flex-col gap-y-1.5">
      <div className="flex items-baseline justify-between gap-x-3">
        <Text size="small" weight="plus" className="text-ui-fg-base">
          {label}
        </Text>
        <div className="flex items-baseline gap-x-2 tabular-nums">
          <Text size="small" className="text-ui-fg-base">
            {fmtNum(value)}
          </Text>
          {rate && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {rate}
            </Text>
          )}
        </div>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--fg-muted, #64748B) 12%, transparent)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, background: accent, minWidth: value > 0 ? 4 : 0 }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Inline-SVG sparkline (CSP-safe, no chart lib)
 * ------------------------------------------------------------------ */

const Sparkline = ({
  id,
  points,
  accent,
  valueFormat,
}: {
  id: string
  points: DayPoint[]
  accent: string
  valueFormat?: (v: number) => string
}) => {
  const W = 680
  const H = 140
  const padX = 10
  const padTop = 16
  const padBottom = 26
  const n = points.length
  const fmt = valueFormat ?? ((v: number) => fmtNum(v))

  if (n === 0) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        No data.
      </Text>
    )
  }

  const max = Math.max(1, ...points.map((p) => Number(p.count) || 0))
  const stepX = n > 1 ? (W - padX * 2) / (n - 1) : 0
  const px = (i: number): number => padX + i * stepX
  const py = (v: number): number =>
    padTop + (1 - v / max) * (H - padTop - padBottom)

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(Number(p.count) || 0).toFixed(1)}`)
    .join(" ")
  const baseY = H - padBottom
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${baseY.toFixed(
    1
  )} L${px(0).toFixed(1)},${baseY.toFixed(1)} Z`

  const last = points[n - 1]
  const lastX = px(n - 1)
  const lastY = py(Number(last.count) || 0)
  const gradId = `spark-grad-${id}`

  return (
    <div className="overflow-x-auto">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Daily activity sparkline"
        style={{ display: "block", minWidth: 420, maxWidth: "100%" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="currentColor"
          strokeOpacity={0.12}
        />

        {/* area + line */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* emphasized latest point */}
        <circle cx={lastX} cy={lastY} r={5.5} fill={accent} fillOpacity={0.18} />
        <circle cx={lastX} cy={lastY} r={3} fill={accent} />

        {/* peak label */}
        <text
          x={padX}
          y={padTop - 4}
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.5}
        >
          peak {fmt(max)}
        </text>

        {/* axis labels */}
        <text
          x={padX}
          y={H - 6}
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.5}
        >
          {fmtDay(points[0].date)}
        </text>
        <text
          x={W - padX}
          y={H - 6}
          fontSize={10}
          textAnchor="end"
          fill="currentColor"
          fillOpacity={0.5}
        >
          {fmtDay(last.date)}
        </text>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const HEADER = {
  icon: ChartBar,
  accent: "violet" as const,
  title: "Brain Analytics",
  subtitle:
    "One honest view of what the marketing engine is doing — from real data.",
}

const BrainAnalyticsPage = () => {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<BrainAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<BrainAnalytics>(`?days=${d}`)
      setData(res)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load brain analytics.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [load, days])

  const noActivity = useMemo(() => {
    if (!data) {
      return false
    }
    return (
      data.email.sent === 0 &&
      data.recovery.carts_detected === 0 &&
      data.recovery.recovered === 0 &&
      !data.journeys.has_data &&
      !data.audience.has_data &&
      data.attribution.total_orders === 0
    )
  }, [data])

  /* ---- Loading skeleton ---- */
  if (loading) {
    return (
      <Container className="p-0">
        <PageHeader
          {...HEADER}
          actions={<RangeControl value={days} onChange={setDays} disabled />}
        />
        <div className="px-6 pb-10">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[92px] animate-pulse rounded-xl border border-ui-border-base bg-ui-bg-subtle"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[220px] animate-pulse rounded-xl border border-ui-border-base bg-ui-bg-subtle"
              />
            ))}
          </div>
        </div>
      </Container>
    )
  }

  /* ---- Error ---- */
  if (error || !data) {
    return (
      <Container className="p-0">
        <PageHeader {...HEADER} />
        <EmptyState
          icon={ChartBar}
          accent="rose"
          title="Couldn't load analytics"
          description={error ?? "No data was returned."}
          action={
            <Button size="small" variant="secondary" onClick={() => load(days)}>
              Retry
            </Button>
          }
        />
      </Container>
    )
  }

  const { email, recovery, journeys, audience, attribution, timeseries } = data
  const emailsSent = sum(timeseries.emails_sent_per_day)
  const recoveredCount = sum(timeseries.recovered_per_day)

  return (
    <Container className="p-0">
      <PageHeader
        {...HEADER}
        actions={<RangeControl value={days} onChange={setDays} />}
      />

      {/* ---- KPI row ---- */}
      <div className="px-6 pb-6">
        <SectionLabel>Last {days} days</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Emails sent"
            value={fmtNum(email.sent)}
            accent="blue"
            icon={Envelope}
          />
          <StatTile
            label="Open rate"
            value={email.has_data ? pct(email.open_rate) : "—"}
            sub={email.has_data ? `${fmtNum(email.opened)} opened` : "no sends yet"}
            accent="teal"
            icon={Eye}
          />
          <StatTile
            label="Click rate"
            value={email.has_data ? pct(email.click_rate) : "—"}
            sub={
              email.has_data ? `${fmtNum(email.clicked)} clicked` : "no sends yet"
            }
            accent="violet"
            icon={CursorArrowRays}
          />
          <StatTile
            label="Carts recovered"
            value={fmtNum(recovery.recovered)}
            sub={`${pct(recovery.recovery_rate)} rate`}
            accent="green"
            icon={ShoppingCart}
          />
          <StatTile
            label="Revenue recovered"
            value={fmtMoney(recovery.recovered_revenue, "usd")}
            accent="amber"
            icon={CurrencyDollar}
          />
          <StatTile
            label="Attributed revenue"
            value={
              attribution.has_data
                ? fmtMoney(attribution.attributed_revenue, "usd")
                : "—"
            }
            sub={
              attribution.has_data
                ? `${fmtNum(attribution.attributed_orders)} orders`
                : "untagged"
            }
            accent="rose"
            icon={Tag}
          />
        </div>
      </div>

      {noActivity ? (
        <div className="px-6 pb-10">
          <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
            <EmptyState
              icon={ChartActivity}
              accent="violet"
              title="No marketing activity yet"
              description="Once you start sending emails, recovering carts, and enrolling contacts in journeys, this dashboard fills in with real numbers."
            />
          </div>
        </div>
      ) : (
        <>
          {/* ---- Panels grid ---- */}
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
            {/* Email funnel */}
            <Panel>
              <SectionLabel>Email funnel</SectionLabel>
              {email.has_data ? (
                <div className="flex flex-col gap-y-4">
                  <FunnelRow
                    label="Sent"
                    value={email.sent}
                    fraction={1}
                    accent={ACCENTS.blue}
                  />
                  <FunnelRow
                    label="Opened"
                    value={email.opened}
                    fraction={email.sent > 0 ? email.opened / email.sent : 0}
                    rate={pct(email.open_rate)}
                    accent={ACCENTS.teal}
                  />
                  <FunnelRow
                    label="Clicked"
                    value={email.clicked}
                    fraction={email.sent > 0 ? email.clicked / email.sent : 0}
                    rate={pct(email.click_rate)}
                    accent={ACCENTS.violet}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ui-border-base pt-3">
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Delivered{" "}
                      <span className="font-medium text-ui-fg-subtle tabular-nums">
                        {fmtNum(email.delivered)}
                      </span>
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Click-to-open{" "}
                      <span className="font-medium text-ui-fg-subtle tabular-nums">
                        {pct(email.click_to_open)}
                      </span>
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Bounced{" "}
                      <span className="font-medium text-ui-fg-subtle tabular-nums">
                        {fmtNum(email.bounced)}
                      </span>
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Suppressed{" "}
                      <span className="font-medium text-ui-fg-subtle tabular-nums">
                        {fmtNum(email.suppressed_total)}
                      </span>
                    </Text>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Envelope}
                  accent="blue"
                  title="No emails sent yet"
                  description="Start sending to see delivery, open, and click metrics here."
                />
              )}
            </Panel>

            {/* Recovery funnel */}
            <Panel>
              <SectionLabel>Cart recovery</SectionLabel>
              {recovery.carts_detected > 0 || recovery.recovered > 0 ? (
                <div className="flex flex-col gap-y-4">
                  <FunnelRow
                    label="Detected"
                    value={recovery.carts_detected}
                    fraction={1}
                    accent={ACCENTS.teal}
                  />
                  <FunnelRow
                    label="Emailed"
                    value={recovery.emailed}
                    fraction={
                      recovery.carts_detected > 0
                        ? recovery.emailed / recovery.carts_detected
                        : 0
                    }
                    accent={ACCENTS.blue}
                  />
                  <FunnelRow
                    label="Recovered"
                    value={recovery.recovered}
                    fraction={
                      recovery.carts_detected > 0
                        ? recovery.recovered / recovery.carts_detected
                        : recovery.recovered > 0
                        ? 1
                        : 0
                    }
                    rate={pct(recovery.recovery_rate)}
                    accent={ACCENTS.green}
                  />
                  <div className="mt-1 flex items-center justify-between border-t border-ui-border-base pt-3">
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Revenue recovered
                    </Text>
                    <Text
                      size="small"
                      weight="plus"
                      className="text-ui-fg-base tabular-nums"
                    >
                      {fmtMoney(recovery.recovered_revenue, "usd")}
                    </Text>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={ShoppingCart}
                  accent="teal"
                  title="No abandoned carts detected"
                  description="Recovered carts and revenue will show up here as shoppers leave items behind."
                />
              )}
            </Panel>

            {/* Journeys */}
            <Panel>
              <SectionLabel>Journeys</SectionLabel>
              {journeys.has_data ? (
                <div className="flex flex-col gap-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Active journeys"
                      value={fmtNum(journeys.active_journeys)}
                      sub={`${fmtNum(journeys.total)} total`}
                    />
                    <MiniStat
                      label="Completion rate"
                      value={pct(journeys.completion_rate)}
                      sub={`${fmtNum(journeys.enrollments.total)} enrolled`}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
                    <Text size="xsmall" weight="plus" className="uppercase tracking-wide text-ui-fg-muted">
                      Enrollments
                    </Text>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <span className="inline-flex items-center gap-x-2">
                        <StatusDot tone="blue">Active</StatusDot>
                        <Text size="small" className="text-ui-fg-base tabular-nums">
                          {fmtNum(journeys.enrollments.active)}
                        </Text>
                      </span>
                      <span className="inline-flex items-center gap-x-2">
                        <StatusDot tone="green">Completed</StatusDot>
                        <Text size="small" className="text-ui-fg-base tabular-nums">
                          {fmtNum(journeys.enrollments.completed)}
                        </Text>
                      </span>
                      <span className="inline-flex items-center gap-x-2">
                        <StatusDot tone="rose">Failed</StatusDot>
                        <Text size="small" className="text-ui-fg-base tabular-nums">
                          {fmtNum(journeys.enrollments.failed)}
                        </Text>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={RocketLaunch}
                  accent="violet"
                  title="No journeys yet"
                  description="Create a journey and enroll contacts to track completion here."
                />
              )}
            </Panel>

            {/* Audience */}
            <Panel>
              <SectionLabel>Audience</SectionLabel>
              {audience.has_data ? (
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Contacts"
                    value={fmtNum(audience.total_contacts)}
                    sub={`${fmtNum(audience.subscribed)} subscribed`}
                  />
                  <MiniStat
                    label="Subscribed"
                    value={pct(
                      audience.total_contacts > 0
                        ? audience.subscribed / audience.total_contacts
                        : 0
                    )}
                    sub="of all contacts"
                  />
                  <MiniStat
                    label="Segments"
                    value={fmtNum(audience.segments)}
                  />
                  <MiniStat
                    label="Segment members"
                    value={fmtNum(audience.segment_members)}
                  />
                </div>
              ) : (
                <EmptyState
                  icon={UserGroup}
                  accent="teal"
                  title="No contacts yet"
                  description="Contacts and segments will appear here as your audience grows."
                />
              )}
            </Panel>
          </div>

          {/* ---- Attribution ---- */}
          <div className="px-6 pb-6">
            <SectionLabel>Revenue attribution</SectionLabel>
            <Panel>
              {attribution.has_data ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MiniStat
                    label="Attributed revenue"
                    value={fmtMoney(attribution.attributed_revenue, "usd")}
                    sub={`${fmtNum(attribution.attributed_orders)} tagged orders`}
                  />
                  <MiniStat
                    label="Store revenue"
                    value={fmtMoney(attribution.total_revenue, "usd")}
                    sub={`${fmtNum(attribution.total_orders)} total orders`}
                  />
                  <MiniStat
                    label="Marketing share"
                    value={pct(
                      attribution.total_revenue > 0
                        ? attribution.attributed_revenue /
                            attribution.total_revenue
                        : 0
                    )}
                    sub="of store revenue"
                  />
                </div>
              ) : (
                <EmptyState
                  icon={Tag}
                  accent="rose"
                  title="No attributed revenue yet"
                  description="Tag orders with utm_source=marketing (or a marketing_campaign_id) to attribute revenue to campaigns."
                />
              )}
            </Panel>
          </div>

          {/* ---- Charts ---- */}
          <div className="grid grid-cols-1 gap-4 px-6 pb-10 lg:grid-cols-2">
            <Panel>
              <div className="mb-2 flex items-baseline justify-between">
                <SectionLabel className="mb-0">Emails sent / day</SectionLabel>
                <Text size="small" weight="plus" className="text-ui-fg-base tabular-nums">
                  {fmtNum(emailsSent)}
                </Text>
              </div>
              <Sparkline
                id="emails"
                points={timeseries.emails_sent_per_day}
                accent={ACCENTS.blue}
              />
            </Panel>
            <Panel>
              <div className="mb-2 flex items-baseline justify-between">
                <SectionLabel className="mb-0">
                  Carts recovered / day
                </SectionLabel>
                <Text size="small" weight="plus" className="text-ui-fg-base tabular-nums">
                  {fmtNum(recoveredCount)}
                </Text>
              </div>
              <Sparkline
                id="recovered"
                points={timeseries.recovered_per_day}
                accent={ACCENTS.green}
              />
            </Panel>
          </div>
        </>
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ *
 * Small presentational helper
 * ------------------------------------------------------------------ */

const MiniStat = ({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: string
}) => (
  <div className="flex flex-col gap-y-0.5">
    <Text size="xsmall" weight="plus" className="uppercase tracking-wide text-ui-fg-muted">
      {label}
    </Text>
    <Text className="text-xl font-semibold leading-tight text-ui-fg-base tabular-nums">
      {value}
    </Text>
    {sub && (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {sub}
      </Text>
    )}
  </div>
)

export const config = defineRouteConfig({
  label: "Brain Analytics",
  icon: ChartBar,
})

export default BrainAnalyticsPage
