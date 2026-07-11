"use client"

import { useEffect, useState } from "react"
import { Bolt } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCallCenterCampaigns,
  type CallCenterCampaign,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"

const campaignStatuses = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
]

export default function CampaignsPage() {
  const { token } = useMerchantAuth()
  const [campaigns, setCampaigns] = useState<CallCenterCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listCallCenterCampaigns(token, { limit: 200 })
      .then((res) => setCampaigns(res.campaigns || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Outbound call campaigns for your store."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: "playbook_id", header: "Playbook" },
          { key: "concurrency", header: "Concurrency" },
          { key: "from_number", header: "From number" },
          {
            key: "created_at",
            header: "Created",
            render: (row) => formatDate(row.created_at),
          },
        ]}
        rows={campaigns}
        isLoading={loading}
        searchKeys={["name", "playbook_id"]}
        filterKey="status"
        filterOptions={campaignStatuses}
        sortKeys={[{ key: "created_at", label: "Created" }]}
        emptyIcon={Bolt}
        emptyTitle="No campaigns yet"
        emptyDescription="Your campaigns will appear here once they are created."
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
  })
}
