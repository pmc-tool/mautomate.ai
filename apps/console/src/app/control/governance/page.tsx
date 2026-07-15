"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  DocumentText,
  ExclamationCircle,
  ListBullet,
  ShieldCheck,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  listAuditEntries,
  listSubprocessors,
  type AuditEntry,
  type Subprocessor,
} from "@/lib/api/governance"
import { DataTable, type Column } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

type Tab = "audit" | "subprocessors"

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

const auditSearchKeys: (keyof AuditEntry)[] = [
  "action",
  "actor",
  "tenant_id",
  "outcome",
  "ip",
]

const subprocessorSearchKeys: (keyof Subprocessor)[] = [
  "name",
  "purpose",
  "data",
  "region",
]

const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "audit", label: "Audit trail", icon: ListBullet },
  { key: "subprocessors", label: "Subprocessors", icon: ShieldCheck },
]

export default function GovernancePage() {
  const { token } = useControlAuth()

  const [activeTab, setActiveTab] = useState<Tab>("audit")
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [subprocessors, setSubprocessors] = useState<Subprocessor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [auditRes, subRes] = await Promise.all([
        listAuditEntries(token),
        listSubprocessors(token),
      ])
      setAuditEntries(auditRes.entries)
      setSubprocessors(subRes.subprocessors)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governance data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const auditColumns = useMemo<Column<AuditEntry>[]>(
    () => [
      {
        key: "action",
        header: "Action",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.action}</span>
        ),
      },
      {
        key: "actor",
        header: "Actor",
        render: (row) => <span className="text-grey-70">{row.actor}</span>,
      },
      {
        key: "tenant_id",
        header: "Tenant",
        render: (row) => (
          <span className="text-grey-70">{row.tenant_id ?? "—"}</span>
        ),
      },
      {
        key: "outcome",
        header: "Outcome",
        render: (row) => <StatusBadge status={row.outcome} />,
      },
      {
        key: "ip",
        header: "IP",
        render: (row) => (
          <span className="font-mono text-xs text-grey-70">{row.ip ?? "—"}</span>
        ),
      },
      {
        key: "at",
        header: "Time",
        render: (row) => (
          <span className="text-grey-70">{formatTime(row.at)}</span>
        ),
      },
    ],
    []
  )

  const subprocessorColumns = useMemo<Column<Subprocessor>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.name}</span>
        ),
      },
      {
        key: "purpose",
        header: "Purpose",
        render: (row) => <span className="text-grey-70">{row.purpose}</span>,
      },
      {
        key: "data",
        header: "Data",
        render: (row) => <span className="text-grey-70">{row.data}</span>,
      },
      {
        key: "region",
        header: "Region",
        render: (row) => <span className="text-grey-70">{row.region}</span>,
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
        title="Governance & Compliance"
        description="Platform audit trail and third-party subprocessor disclosures."
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
        <div className="mb-5 border-b border-grey-10">
          <nav className="-mb-px flex gap-6" aria-label="Governance tabs">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors focus:outline-none",
                  activeTab === key
                    ? "border-grey-90 text-grey-90"
                    : "border-transparent text-grey-50 hover:border-grey-30 hover:text-grey-70"
                )}
                aria-current={activeTab === key ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "audit" && (
          <DataTable
            columns={auditColumns}
            rows={auditEntries}
            searchKeys={auditSearchKeys}
            isLoading={loading}
            emptyIcon={DocumentText}
            emptyTitle="No audit entries"
            emptyDescription="Platform audit events will appear here once actions are recorded."
          />
        )}

        {activeTab === "subprocessors" && (
          <DataTable
            columns={subprocessorColumns}
            rows={subprocessors}
            searchKeys={subprocessorSearchKeys}
            isLoading={loading}
            emptyIcon={ShieldCheck}
            emptyTitle="No subprocessors"
            emptyDescription="Subprocessor disclosures will appear here once configured."
          />
        )}
      </div>
    </div>
  )
}
