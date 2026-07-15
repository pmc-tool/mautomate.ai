"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowPath, ChartBar, Eye, Users, BuildingStorefront } from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { getPlatformAnalytics, type PlatformAnalytics } from "@/lib/api/analytics"
import { PageHeader } from "@/components/page-header"
import { KpiCard } from "@/components/kpi-card"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

const RANGES = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
]

export default function PlatformAnalyticsPage() {
  const { token } = useControlAuth()
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<PlatformAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setData(await getPlatformAnalytics(token, range))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [token, range])

  useEffect(() => {
    load()
  }, [load])

  const totals = data?.totals
  const sites = data?.websites ?? []
  const maxPv = Math.max(1, ...sites.map((s) => s.pageviews))

  const headerAction = (
    <div className="flex items-center gap-2">
      <div className="flex overflow-hidden rounded-base border border-grey-20 text-sm">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "border-r border-grey-20 px-3 py-2 last:border-r-0",
              range === r.key ? "bg-grey-90 text-white" : "text-grey-60 hover:bg-grey-10"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Platform-wide storefront traffic across every tenant."
        action={headerAction}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          ))}
        </div>
      ) : data && data.enabled === false ? (
        <EmptyState title="Analytics not enabled" description="Set UMAMI_* env vars on the backend to enable platform analytics." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Page views" value={(totals?.pageviews ?? 0).toLocaleString()} icon={Eye} tone="brand" />
            <KpiCard label="Visitors" value={(totals?.visitors ?? 0).toLocaleString()} icon={Users} tone="grey" />
            <KpiCard label="Active stores" value={(data?.site_count ?? 0).toLocaleString()} icon={BuildingStorefront} tone="grey" />
          </div>

          <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
            <div className="flex items-center gap-2 border-b border-grey-20 px-5 py-3">
              <ChartBar className="h-4 w-4 text-grey-50" />
              <h3 className="text-sm font-semibold text-grey-90">Stores by traffic</h3>
            </div>
            {sites.length === 0 ? (
              <div className="px-5 py-8 text-sm text-grey-40">No traffic recorded yet.</div>
            ) : (
              <div className="divide-y divide-grey-10">
                {sites.slice(0, 100).map((s) => (
                  <div key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-grey-90">{s.name || s.domain || s.id}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-grey-10">
                        <span className="block h-full bg-cyan-500" style={{ width: `${(s.pageviews / maxPv) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-grey-90">{s.pageviews.toLocaleString()}</p>
                      <p className="text-[11px] text-grey-40">page views</p>
                    </div>
                    <div className="w-16 text-right">
                      <p className="text-sm tabular-nums text-grey-70">{s.visitors.toLocaleString()}</p>
                      <p className="text-[11px] text-grey-40">visitors</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
