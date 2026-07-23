"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftMini, Bolt } from "@medusajs/icons"
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

function formatWhen(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric"
  return `${d.toLocaleDateString(undefined, opts)}, ${time}`
}

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
      <Link
        href="/dashboard/calls"
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Call Center
      </Link>

      <PageHeader
        title="Campaigns"
        description="Outbound calling campaigns — who they dial, how fast, and where they stand."
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
              <span className="font-medium text-grey-90">{row.name || "—"}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "playbook_id",
            header: "Playbook",
            render: (row) =>
              row.playbook_id ? (
                <span className="font-mono text-xs text-grey-70">{row.playbook_id}</span>
              ) : (
                <span className="text-grey-40">—</span>
              ),
          },
          {
            key: "concurrency",
            header: "Concurrency",
            render: (row) => (
              <span className="tabular-nums text-grey-70">{row.concurrency ?? "—"}</span>
            ),
          },
          {
            key: "from_number",
            header: "From number",
            render: (row) =>
              row.from_number ? (
                <span className="font-mono text-[13px] text-grey-90">{row.from_number}</span>
              ) : (
                <span className="text-grey-40">—</span>
              ),
          },
          {
            key: "created_at",
            header: "Created",
            className: "whitespace-nowrap",
            render: (row) => (
              <span className="text-grey-70">{formatWhen(row.created_at)}</span>
            ),
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
        emptyDescription="Campaigns appear here once you launch one from an agent's studio."
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
