"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChartBar, Eye, Users, CursorArrowRays, ArrowUturnLeft, Clock, Bolt } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { getMerchantAnalytics, type MerchantAnalytics } from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { cn } from "@lib/util/cn"

const RANGES = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
]

type Row = { x: string; y: number }
const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0))

function fmtDuration(sec: number): string {
  if (!sec || sec < 1) return "0s"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function AreaChart({ points }: { points: Row[] }) {
  const w = 720, h = 200, pad = 8
  if (!points.length) return <div className="flex h-[200px] items-center justify-center text-sm text-grey-40">No data in this period yet.</div>
  const max = Math.max(1, ...points.map((p) => p.y))
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const xy = (i: number, y: number): [number, number] => [pad + i * step, h - pad - (y / max) * (h - pad * 2)]
  const line = points.map((p, i) => { const [x, yy] = xy(i, p.y); return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}` }).join(" ")
  const [x0] = xy(0, 0), [xN] = xy(points.length - 1, 0)
  const area = `${line} L${xN.toFixed(1)},${h - pad} L${x0.toFixed(1)},${h - pad} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(8 145 178)" stopOpacity="0.22" /><stop offset="100%" stopColor="rgb(8 145 178)" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke="rgb(8 145 178)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function TopList({ title, rows, fmt, always }: { title: string; rows?: Row[]; fmt?: (s: string) => string; always?: boolean }) {
  const data = rows ?? []
  if (!always && data.length === 0) return null
  const max = Math.max(1, ...data.map((r) => n(r.y)))
  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
      <h3 className="mb-3 text-sm font-semibold text-grey-90">{title}</h3>
      {data.length === 0 ? (
        <p className="py-3 text-sm text-grey-40">No data yet.</p>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 10).map((r, i) => (
            <div key={i} className="relative flex items-center justify-between overflow-hidden rounded-base px-2.5 py-1.5">
              <div className="absolute inset-y-0 left-0 rounded-base bg-cyan-50" style={{ width: `${(n(r.y) / max) * 100}%` }} />
              <span className="relative z-10 truncate pr-3 text-sm text-grey-80">{fmt ? fmt(r.x || "") : (r.x || "Direct / none")}</span>
              <span className="relative z-10 text-sm font-medium tabular-nums text-grey-90">{n(r.y).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const COUNTRY: Record<string, string> = { US: "United States", GB: "United Kingdom", AU: "Australia", BD: "Bangladesh", IN: "India", CA: "Canada", DE: "Germany", FR: "France", NL: "Netherlands", SG: "Singapore" }
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown")

export default function AnalyticsPage() {
  const { token } = useMerchantAuth()
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<MerchantAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true); setError(null)
    try { setData(await getMerchantAnalytics(token, range)) }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load analytics") }
    finally { setLoading(false) }
  }, [token, range])

  useEffect(() => { load() }, [load])
  // realtime auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => { if (token) load() }, 30000)
    return () => clearInterval(t)
  }, [token, load])

  const stats = data?.stats
  const top = data?.top
  const bounceRate = useMemo(() => { const v = n(stats?.visits), b = n(stats?.bounces); return v > 0 ? Math.round((b / v) * 100) : 0 }, [stats])
  const avgTime = useMemo(() => { const v = n(stats?.visits), t = n(stats?.totaltime); return v > 0 ? t / v : 0 }, [stats])
  const perVisit = useMemo(() => { const v = n(stats?.visits), p = n(stats?.pageviews); return v > 0 ? (p / v).toFixed(1) : "0" }, [stats])
  const series = (data?.series?.pageviews ?? []).map((p: any) => ({ x: String(p.x), y: n(p.y) }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Traffic and visitor behaviour for your storefront. Updates in near real-time."
        action={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {n(data?.realtime)} online now
            </span>
            <div className="flex overflow-hidden rounded-base border border-grey-20 text-sm">
              {RANGES.map((r) => (
                <button key={r.key} onClick={() => setRange(r.key)} className={cn("border-r border-grey-20 px-3 py-2 last:border-r-0", range === r.key ? "bg-grey-90 text-white" : "text-grey-60 hover:bg-grey-10")}>{r.label}</button>
              ))}
            </div>
          </div>
        }
      />

      {error && <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-large border border-grey-20 bg-grey-10" />)}</div>
      ) : data && data.enabled === false ? (
        <EmptyState title="Analytics not enabled" description="Web analytics isn't switched on for the platform yet. Contact support." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Visitors" value={n(stats?.visitors).toLocaleString()} icon={Users} tone="brand" />
            <KpiCard label="Page views" value={n(stats?.pageviews).toLocaleString()} icon={Eye} tone="grey" />
            <KpiCard label="Visits" value={n(stats?.visits).toLocaleString()} icon={CursorArrowRays} tone="grey" />
            <KpiCard label="Bounce rate" value={`${bounceRate}%`} icon={ArrowUturnLeft} tone="grey" />
            <KpiCard label="Avg. visit" value={fmtDuration(avgTime)} icon={Clock} tone="grey" />
            <KpiCard label="Views / visit" value={perVisit} icon={Bolt} tone="grey" />
          </div>

          <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
            <div className="mb-2 flex items-center gap-2"><ChartBar className="h-4 w-4 text-grey-50" /><h3 className="text-sm font-semibold text-grey-90">Page views over time</h3></div>
            <AreaChart points={series} />
          </div>

          {/* Content */}
          <SectionLabel>Content</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            <TopList title="Top pages" rows={top?.pages} always />
            <TopList title="Top referrers" rows={top?.referrers} always />
            <TopList title="Entry pages" rows={top?.entry} />
            <TopList title="Exit pages" rows={top?.exit} />
          </div>

          {/* Audience */}
          <SectionLabel>Audience</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            <TopList title="Countries" rows={top?.countries} fmt={(c) => COUNTRY[c?.toUpperCase?.()] ?? (c || "Unknown")} always />
            <TopList title="Devices" rows={top?.devices} fmt={cap} always />
            <TopList title="Browsers" rows={top?.browsers} fmt={cap} />
            <TopList title="Operating systems" rows={top?.os} />
            <TopList title="Languages" rows={top?.languages} fmt={(l) => l?.toUpperCase?.() || "Unknown"} />
            <TopList title="Screen sizes" rows={top?.screens} />
            <TopList title="Regions" rows={top?.regions} />
            <TopList title="Cities" rows={top?.cities} />
          </div>

          {/* Acquisition (only when present) */}
          {((top?.campaigns?.length ?? 0) > 0 || (top?.events?.length ?? 0) > 0) && (
            <>
              <SectionLabel>Acquisition &amp; events</SectionLabel>
              <div className="grid gap-4 lg:grid-cols-2">
                <TopList title="Campaigns (UTM)" rows={top?.campaigns} />
                <TopList title="Events" rows={top?.events} />
              </div>
            </>
          )}

          {n(stats?.pageviews) === 0 && (
            <p className="text-center text-sm text-grey-40">No visits recorded yet — data appears here as shoppers browse your storefront.</p>
          )}
        </>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 mb-1 flex items-center gap-3 px-0.5"><span className="text-xs font-semibold uppercase tracking-wide text-grey-50">{children}</span><span className="h-px flex-1 bg-grey-20" /></div>
}
