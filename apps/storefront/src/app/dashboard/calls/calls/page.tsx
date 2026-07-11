"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DocumentText } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCallCenterCalls,
  type CallCenterCall,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"

const callStatuses = [
  { value: "queued", label: "Queued" },
  { value: "dialing", label: "Dialing" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "canceled", label: "Canceled" },
]

export default function CallsPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [calls, setCalls] = useState<CallCenterCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listCallCenterCalls(token, { limit: 200 })
      .then((res) => setCalls(res.calls || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load calls"))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calls"
        description="Inbound and outbound call history."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: "id",
            header: "Call ID",
            render: (row) => <span className="font-mono text-xs">{row.id}</span>,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: "direction", header: "Direction" },
          { key: "to_number", header: "To" },
          { key: "disposition", header: "Disposition" },
          { key: "sentiment", header: "Sentiment" },
          {
            key: "cost_total",
            header: "Cost",
            render: (row) => `$${(row.cost_total ?? 0).toFixed(2)}`,
          },
          {
            key: "created_at",
            header: "Created",
            render: (row) => formatDate(row.created_at),
          },
        ]}
        rows={calls}
        onRowClick={(row) => router.push(`/dashboard/calls/calls/${row.id}`)}
        isLoading={loading}
        searchKeys={["id", "to_number", "disposition", "order_id"]}
        filterKey="status"
        filterOptions={callStatuses}
        sortKeys={[{ key: "created_at", label: "Date" }]}
        emptyIcon={DocumentText}
        emptyTitle="No calls yet"
        emptyDescription="Calls will appear here once your campaigns start dialing."
      />
    </div>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
