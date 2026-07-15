"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  CheckCircleSolid,
  CircleWarningSolid,
  CreditCard,
  ExclamationCircle,
  Eye,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  getObservability,
  type HealthCheck,
  type DriftedWallet,
  type ObservabilityResponse,
  type ProviderHealth,
} from "@/lib/api/observability"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function SkeletonValue() {
  return <div className="h-7 w-24 rounded bg-grey-10 animate-pulse" />
}

const healthSearchKeys: (keyof HealthCheck)[] = ["service", "detail"]
const driftSearchKeys: (keyof DriftedWallet)[] = ["tenant_id"]

const SEVERITY_STYLE: Record<
  ProviderHealth["severity"],
  { ring: string; dot: string; label: string; text: string }
> = {
  ok: {
    ring: "border-grey-20",
    dot: "bg-emerald-500",
    label: "Healthy",
    text: "text-emerald-700",
  },
  warn: {
    ring: "border-amber-300 bg-amber-50",
    dot: "bg-amber-500",
    label: "Running low",
    text: "text-amber-800",
  },
  critical: {
    ring: "border-red-300 bg-red-50",
    dot: "bg-red-500",
    label: "DOWN",
    text: "text-red-700",
  },
  unknown: {
    ring: "border-grey-20",
    dot: "bg-grey-30",
    label: "Not configured",
    text: "text-grey-50",
  },
}

/**
 * Vendor health.
 *
 * Every internal check on this page was green on the morning the OpenAI account
 * hit zero — the database was fine, the ledger balanced, the processes online —
 * while two customers phoned the voice agent and heard nothing at all. Green
 * infrastructure is not a working product. These are the services a customer
 * actually touches, and whether they can serve RIGHT NOW.
 */
function ProviderPanel({ providers }: { providers: ProviderHealth[] }) {
  if (!providers.length) return null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-grey-90">
          Vendors — can they serve right now?
        </h2>
        <p className="text-xs text-grey-50">Re-probed on refresh</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => {
          const style = SEVERITY_STYLE[p.severity]
          const percent = p.remaining?.percent

          return (
            <div
              key={p.service}
              className={cn(
                "rounded-large border p-4 shadow-sm",
                style.ring
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)}
                    aria-hidden="true"
                  />
                  <p className="truncate text-sm font-semibold text-grey-90">
                    {p.service}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                    style.text
                  )}
                >
                  {style.label}
                </span>
              </div>

              <p className="mt-0.5 truncate text-xs text-grey-50">{p.role}</p>

              {/* A balance bar only where the vendor actually tells us one. An
                  invented bar would be worse than none: it would imply we are
                  watching a number nobody can see. */}
              {percent !== undefined && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-grey-10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        percent <= 15 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-grey-70">
                    {p.remaining!.value.toLocaleString()} {p.remaining!.unit} left
                    {` (${percent}%)`}
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs leading-relaxed text-grey-60">
                {p.detail}
              </p>

              {p.single_point_of_failure && (
                <p className="mt-2 text-[11px] font-medium text-grey-50">
                  No standby — if this dies, the capability goes with it.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ObservabilityPage() {
  const { token } = useControlAuth()

  const [data, setData] = useState<ObservabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getObservability(token, true)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load observability data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const healthyCount = useMemo(
    () => data?.health.filter((h) => h.ok).length ?? 0,
    [data]
  )
  const unhealthyCount = useMemo(
    () => data?.health.filter((h) => !h.ok).length ?? 0,
    [data]
  )
  const walletsChecked = data?.reconciliation.wallets_checked ?? 0
  const driftedCount = data?.reconciliation.drifted.length ?? 0

  const healthColumns = useMemo<Column<HealthCheck>[]>(
    () => [
      {
        key: "service",
        header: "Service",
        render: (row) => <span className="font-medium text-grey-90">{row.service}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.ok ? "success" : "failed"} />,
      },
      {
        key: "detail",
        header: "Detail",
        render: (row) => (
          <span className="text-grey-70">{row.detail || "—"}</span>
        ),
      },
    ],
    []
  )

  const driftColumns = useMemo<Column<DriftedWallet>[]>(
    () => [
      {
        key: "tenant_id",
        header: "Tenant ID",
        render: (row) => <span className="font-medium text-grey-90">{row.tenant_id}</span>,
      },
      {
        key: "drift",
        header: "Drift amount",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums text-grey-90">
            {row.drift.toLocaleString()}
          </span>
        ),
      },
    ],
    []
  )

  const headerActions = (
    <button
      onClick={load}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
    >
      <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
      Refresh
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observability"
        description="Platform health checks and wallet reconciliation drift."
        action={headerActions}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* The thing that should have been screaming that morning. */}
      {!!data?.provider_alerts?.length && (
        <div className="rounded-large border border-red-300 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {data.provider_alerts.length} vendor
                {data.provider_alerts.length > 1 ? "s need" : " needs"} attention
              </p>
              <ul className="mt-1 space-y-0.5">
                {data.provider_alerts.map((p) => (
                  <li key={p.service} className="text-xs text-red-700">
                    <span className="font-semibold">{p.service}</span> — {p.detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <ProviderPanel providers={data?.providers ?? []} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Healthy services"
          value={loading ? <SkeletonValue /> : healthyCount}
          icon={CheckCircleSolid}
          tone="green"
        />
        <KpiCard
          label="Unhealthy services"
          value={loading ? <SkeletonValue /> : unhealthyCount}
          icon={ExclamationCircle}
          tone="grey"
        />
        <KpiCard
          label="Wallets checked"
          value={loading ? <SkeletonValue /> : walletsChecked.toLocaleString()}
          icon={CreditCard}
          tone="brand"
        />
        <KpiCard
          label="Drifted wallets"
          value={loading ? <SkeletonValue /> : driftedCount}
          icon={CircleWarningSolid}
          tone={driftedCount > 0 ? "grey" : "green"}
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Health checks</h3>
        <DataTable
          columns={healthColumns}
          rows={data?.health ?? []}
          searchKeys={healthSearchKeys}
          isLoading={loading}
          emptyIcon={Eye}
          emptyTitle="No health checks"
          emptyDescription="Health check results will appear here once the platform scan completes."
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Drifted wallets</h3>
        <DataTable
          columns={driftColumns}
          rows={data?.reconciliation.drifted ?? []}
          searchKeys={driftSearchKeys}
          isLoading={loading}
          emptyIcon={CheckCircleSolid}
          emptyTitle="No drifted wallets"
          emptyDescription="All checked wallets are currently in sync."
        />
      </div>
    </div>
  )
}
