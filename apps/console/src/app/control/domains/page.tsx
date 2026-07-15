"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowPath, ExclamationCircle, Globe } from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { listDomains, type Domain } from "@/lib/api/domains"
import { DataTable, type Column } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

const searchKeys: (keyof Domain)[] = [
  "domain",
  "tenant",
  "type",
  "ssl_status",
  "verification_status",
]

const typeOptions = [
  { value: "free", label: "Free" },
  { value: "custom", label: "Custom" },
]

export default function DomainsPage() {
  const { token } = useControlAuth()

  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listDomains(token)
      setDomains(res.domains)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<Column<Domain>[]>(
    () => [
      {
        key: "domain",
        header: "Domain",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.domain}</p>
            <p className="text-xs text-grey-50">{row.tenant}</p>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset",
              row.type === "custom"
                ? "bg-sky-50 text-sky-800 ring-sky-200"
                : "bg-grey-10 text-grey-70 ring-grey-20"
            )}
          >
            {row.type}
          </span>
        ),
      },
      {
        key: "is_primary",
        header: "Primary",
        render: (row) => (
          <StatusBadge status={row.is_primary ? "active" : "secondary"} />
        ),
      },
      {
        key: "ssl_status",
        header: "SSL Status",
        render: (row) => <StatusBadge status={row.ssl_status} />,
      },
      {
        key: "verification_status",
        header: "Verification",
        render: (row) => <StatusBadge status={row.verification_status} />,
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
        title="Domains"
        description="All free and custom domains across tenant stores."
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

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={domains}
          searchKeys={searchKeys}
          filterKey="type"
          filterOptions={typeOptions}
          isLoading={loading}
          emptyIcon={Globe}
          emptyTitle="No domains yet"
          emptyDescription="Custom and free subdomain records will appear here once tenants add them."
        />
      </div>
    </div>
  )
}
