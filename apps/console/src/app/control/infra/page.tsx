"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ArrowRightOnRectangle,
  Bolt,
  CogSixTooth,
  ExclamationCircle,
  ServerStack,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { getInfra, type InfraInstance, type InfraJob, type InfraResponse } from "@/lib/api/infra"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function SkeletonValue() {
  return <div className="h-7 w-24 rounded bg-grey-10 animate-pulse" />
}

function formatDate(value: Date | string | null | undefined): string {
  if (value == null) return "—"
  return new Date(value).toLocaleString()
}

function isTerminal(status: string | null | undefined): boolean {
  const s = status?.toLowerCase() ?? ""
  return s === "done" || s === "live"
}

const instanceSearchKeys: (keyof InfraInstance)[] = [
  "tenant",
  "slug",
  "status",
  "backend_url",
  "container_ref",
  "db_name",
]

const jobSearchKeys: (keyof InfraJob)[] = [
  "id",
  "tenant",
  "status",
  "current_step",
]

export default function InfraPage() {
  const { token, logout } = useControlAuth()

  const [infra, setInfra] = useState<InfraResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getInfra(token)
      setInfra(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load infrastructure")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const activeJobs = infra?.jobs.length ?? 0
  const stuckJobs = useMemo(
    () => (infra?.jobs ?? []).filter((job) => !isTerminal(job.status)).length,
    [infra]
  )

  const jobStatuses = useMemo(() => {
    const statuses = new Set(
      (infra?.jobs ?? [])
        .map((j) => j.status)
        .filter((s): s is string => typeof s === "string")
    )
    return Array.from(statuses).map((value) => ({
      value,
      label: value.replace(/_/g, " "),
    }))
  }, [infra])

  const instanceColumns = useMemo<Column<InfraInstance>[]>(
    () => [
      {
        key: "tenant",
        header: "Tenant",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.tenant}</span>
        ),
      },
      {
        key: "slug",
        header: "Slug",
        render: (row) => <span className="text-grey-70">{row.slug}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "backend_url",
        header: "Backend URL",
        render: (row) =>
          row.backend_url ? (
            <a
              href={row.backend_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-cyan-700 hover:underline"
            >
              {row.backend_url}
            </a>
          ) : (
            <span className="text-grey-40">—</span>
          ),
      },
      {
        key: "container_ref",
        header: "Container",
        render: (row) => (
          <span className="font-mono text-xs text-grey-60">
            {row.container_ref ?? "—"}
          </span>
        ),
      },
      {
        key: "db_name",
        header: "DB",
        render: (row) => (
          <span className="font-mono text-xs text-grey-60">
            {row.db_name ?? "—"}
          </span>
        ),
      },
    ],
    []
  )

  const jobColumns = useMemo<Column<InfraJob>[]>(
    () => [
      {
        key: "id",
        header: "ID",
        render: (row) => (
          <span className="font-mono text-xs text-grey-70">{row.id}</span>
        ),
      },
      {
        key: "tenant",
        header: "Tenant",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.tenant}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "current_step",
        header: "Current step",
        render: (row) => (
          <span className="text-grey-70">
            {row.current_step?.replace(/_/g, " ") ?? "—"}
          </span>
        ),
      },
      {
        key: "attempts",
        header: "Attempts",
        render: (row) => (
          <span className="tabular-nums text-grey-90">{row.attempts}</span>
        ),
      },
      {
        key: "at",
        header: "Started at",
        render: (row) => (
          <span className="text-grey-70">{formatDate(row.at)}</span>
        ),
      },
    ],
    []
  )

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
      >
        <ArrowRightOnRectangle className="h-4 w-4" />
        Sign out
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure"
        description="Platform provisioning status, instances and background jobs."
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
          label="Provisioner mode"
          value={loading ? <SkeletonValue /> : infra?.provisioner ?? "—"}
          icon={CogSixTooth}
          tone="brand"
        />
        <KpiCard
          label="Total instances"
          value={loading ? <SkeletonValue /> : infra?.instances.length ?? 0}
          icon={ServerStack}
          tone="grey"
        />
        <KpiCard
          label="Active jobs"
          value={loading ? <SkeletonValue /> : activeJobs}
          icon={Bolt}
          tone="green"
        />
        <KpiCard
          label="Failed / stuck jobs"
          value={loading ? <SkeletonValue /> : stuckJobs}
          icon={ExclamationCircle}
          tone="grey"
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Instances</h3>
        <DataTable
          columns={instanceColumns}
          rows={infra?.instances ?? []}
          searchKeys={instanceSearchKeys}
          isLoading={loading}
          emptyIcon={ServerStack}
          emptyTitle="No instances"
          emptyDescription="Provisioned instances will appear here once the platform has records."
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Provisioning jobs</h3>
        <DataTable
          columns={jobColumns}
          rows={infra?.jobs ?? []}
          searchKeys={jobSearchKeys}
          filterKey="status"
          filterOptions={jobStatuses}
          sortKeys={[{ key: "at", label: "Started at" }]}
          isLoading={loading}
          emptyIcon={Bolt}
          emptyTitle="No jobs"
          emptyDescription="Provisioning jobs will appear here when tenants are being set up."
        />
      </div>
    </div>
  )
}
