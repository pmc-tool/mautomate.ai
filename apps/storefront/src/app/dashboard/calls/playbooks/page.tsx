"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftMini, BookOpen, ChevronRightMini } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCallCenterPlaybooks,
  type CallCenterPlaybook,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"

export default function PlaybooksPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [playbooks, setPlaybooks] = useState<CallCenterPlaybook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listCallCenterPlaybooks(token)
      .then((res) => setPlaybooks(res.playbooks || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load playbooks"))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/calls"
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Call Center
      </Link>

      <PageHeader
        title="Playbooks"
        description="The conversation scripts behind your agents. Open one to edit it in the agent studio."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <div className="min-w-0">
                <p className="font-medium text-grey-90">{row.name || "—"}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-grey-40">{row.id}</p>
              </div>
            ),
          },
          {
            key: "use_case",
            header: "Use case",
            render: (row) =>
              row.use_case ? (
                <span className="capitalize text-grey-70">
                  {row.use_case.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-grey-40">—</span>
              ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "version",
            header: "Version",
            render: (row) =>
              row.version ? (
                <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 font-mono text-xs text-grey-70">
                  {row.version}
                </span>
              ) : (
                <span className="text-grey-40">—</span>
              ),
          },
          {
            key: "chevron",
            header: "",
            className: "w-10 text-right",
            render: () => (
              <ChevronRightMini className="ml-auto h-4 w-4 text-grey-40" />
            ),
          },
        ]}
        rows={playbooks}
        onRowClick={(row) => router.push(`/dashboard/calls/agents/${row.id}`)}
        isLoading={loading}
        searchKeys={["id", "name", "use_case"]}
        emptyIcon={BookOpen}
        emptyTitle="No playbooks found"
        emptyDescription="Playbooks are created alongside agents and will appear here once one exists."
        emptyAction={
          <Link
            href="/dashboard/calls/agents"
            className="inline-flex items-center rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            Create an agent
          </Link>
        }
      />
    </div>
  )
}
