"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ExclamationCircle,
  Globe,
  Server,
  Sparkles,
  Users,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  getAiAbuse,
  type AiAbuseResponse,
  type AiProvider,
} from "@/lib/api/aiabuse"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function SkeletonValue() {
  return <div className="h-7 w-20 rounded bg-grey-10 animate-pulse" />
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="h-4 w-1/3 rounded bg-grey-10 animate-pulse" />
      <div className="h-4 w-16 rounded bg-grey-10 animate-pulse" />
    </div>
  )
}

const searchKeys: (keyof AiProvider)[] = ["name", "category"]

export default function AiAbusePage() {
  const { token } = useControlAuth()

  const [data, setData] = useState<AiAbuseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getAiAbuse(token)
      setData(res)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load AI & Abuse settings"
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const configuredCount = useMemo(
    () => data?.ai.filter((provider) => provider.configured).length ?? 0,
    [data]
  )

  const columns = useMemo<Column<AiProvider>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        sortable: true,
      },
      {
        key: "category",
        header: "Category",
        sortable: true,
        render: (row) => (
          <span className="capitalize text-grey-70">{row.category}</span>
        ),
      },
      {
        key: "configured",
        header: "Configured",
        render: (row) => (
          <StatusBadge status={row.configured ? "active" : "inactive"} />
        ),
      },
    ],
    []
  )

  const filterOptions = useMemo(
    () => [
      { value: "true", label: "Configured" },
      { value: "false", label: "Not configured" },
    ],
    []
  )

  const sortKeys = useMemo(
    () => [
      { key: "name" as const, label: "Name" },
      { key: "category" as const, label: "Category" },
      { key: "configured" as const, label: "Configured" },
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
        title="AI & Abuse"
        description="Monitor AI provider configuration, signup gating and rate quotas."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="AI providers configured"
          value={loading ? <SkeletonValue /> : configuredCount}
          icon={Sparkles}
          tone="brand"
          trend={loading ? undefined : `${data?.ai.length ?? 0} total`}
        />
        <KpiCard
          label="Signup status"
          value={loading ? <SkeletonValue /> : data?.signup_open ? "Open" : "Closed"}
          icon={Users}
          tone={data?.signup_open ? "green" : "grey"}
        />
        <KpiCard
          label="Quota per IP / hour"
          value={loading ? <SkeletonValue /> : data?.quota.per_ip_per_hour ?? 0}
          icon={Server}
          tone="grey"
          trend={
            loading
              ? undefined
              : `${data?.quota.window_hours ?? 0} hour window`
          }
        />
        <KpiCard
          label="Global quota / hour"
          value={loading ? <SkeletonValue /> : data?.quota.global_per_hour ?? 0}
          icon={Globe}
          tone="grey"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-grey-90">AI Providers</h2>
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <DataTable
            columns={columns}
            rows={data?.ai ?? []}
            searchKeys={searchKeys}
            filterKey="configured"
            filterOptions={filterOptions}
            sortKeys={sortKeys}
            isLoading={loading}
            emptyIcon={Sparkles}
            emptyTitle="No AI providers"
            emptyDescription="AI provider configuration will appear here once registered on the platform."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-grey-90">Rate Quotas</h2>
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          {loading ? (
            <div className="divide-y divide-grey-10">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-grey-10 text-grey-70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Setting</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  <tr>
                    <td className="px-4 py-3 text-grey-70">
                      Requests per IP per hour
                    </td>
                    <td className="px-4 py-3 font-medium text-grey-90">
                      {data?.quota.per_ip_per_hour ?? 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-grey-70">
                      Global requests per hour
                    </td>
                    <td className="px-4 py-3 font-medium text-grey-90">
                      {data?.quota.global_per_hour ?? 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-grey-70">Window</td>
                    <td className="px-4 py-3 font-medium text-grey-90">
                      {data?.quota.window_hours ?? 0} hours
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-grey-90">Signup Gating</h2>
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-grey-90">Public signup</p>
              <p className="text-sm text-grey-50">
                Whether new users can create accounts without an invite.
              </p>
            </div>
            {loading ? (
              <SkeletonValue />
            ) : (
              <StatusBadge
                status={data?.signup_open ? "open" : "closed"}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
