"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen } from "@medusajs/icons"
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
      <PageHeader
        title="Playbooks"
        description="Conversation scripts behind your agents. Open one to edit it in the agent studio."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          { key: "id", header: "ID", render: (row) => <span className="font-mono text-xs">{row.id}</span> },
          { key: "name", header: "Name" },
          { key: "use_case", header: "Use case" },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: "version", header: "Version" },
        ]}
        rows={playbooks}
        onRowClick={(row) => router.push(`/dashboard/calls/agents/${row.id}`)}
        isLoading={loading}
        searchKeys={["id", "name", "use_case"]}
        emptyIcon={BookOpen}
        emptyTitle="No playbooks found"
        emptyDescription="Playbooks will appear here once they are configured for your tenant."
      />
    </div>
  )
}
