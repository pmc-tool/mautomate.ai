"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ChatBubbleLeftRight,
  Bolt,
  DocumentText,
  BookOpen,
  ChartBar,
  Robot,
  Calendar,
  Clock,
  ArrowUpRightOnBox,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterDashboard,
  type CallCenterDashboard,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { cn } from "@lib/util/cn"

function formatCost(amount = 0) {
  return `$${(Number(amount) || 0).toFixed(2)}`
}

export default function CallCenterOverviewPage() {
  const { token } = useMerchantAuth()
  const [dashboard, setDashboard] = useState<CallCenterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getCallCenterDashboard(token)
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [token])

  const connectedToday =
    (dashboard?.calls_today.by_status?.completed ?? 0) +
    (dashboard?.calls_today.by_status?.in_progress ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Center"
        description="Voice campaigns, calls, and analytics for your store."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Today's calls"
          value={loading ? "—" : dashboard?.calls_today.total ?? 0}
          icon={ChatBubbleLeftRight}
          tone="brand"
        />
        <KpiCard
          label="Connected today"
          value={loading ? "—" : connectedToday}
          icon={ChatBubbleLeftRight}
          tone="green"
        />
        <KpiCard
          label="Talk time (min)"
          value={loading ? "—" : dashboard?.total_minutes ?? 0}
          icon={Clock}
        />
        <KpiCard
          label="Today's cost"
          value={loading ? "—" : formatCost(dashboard?.total_cost)}
          icon={ChartBar}
          tone="grey"
        />
        <KpiCard
          label="Scheduled tasks"
          value={loading ? "—" : dashboard?.tasks_scheduled ?? 0}
          icon={Calendar}
        />
        <KpiCard
          label="Running campaigns"
          value={loading ? "—" : dashboard?.campaigns_running ?? 0}
          icon={Bolt}
          tone="green"
        />
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-grey-90">Call status today</h3>
        <div className="flex flex-wrap gap-2">
          {loading || !dashboard ? (
            <p className="text-sm text-grey-50">Loading…</p>
          ) : Object.keys(dashboard.calls_today.by_status).length === 0 ? (
            <p className="text-sm text-grey-50">No calls yet today.</p>
          ) : (
            Object.entries(dashboard.calls_today.by_status).map(([status, count]) => (
              <div
                key={status}
                className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm shadow-borders-base"
              >
                <StatusBadge status={status} />
                <span className="font-medium text-grey-90">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-grey-90">Quick links</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLinkCard
            href="/dashboard/calls/campaigns"
            icon={Bolt}
            title="Campaigns"
            description="View outbound campaigns and their status."
          />
          <QuickLinkCard
            href="/dashboard/calls/calls"
            icon={DocumentText}
            title="Calls"
            description="Browse call history and outcomes."
          />
          <QuickLinkCard
            href="/dashboard/calls/playbooks"
            icon={BookOpen}
            title="Playbooks"
            description="Conversation scripts and versions."
          />
          <QuickLinkCard
            href="/dashboard/calls/analytics"
            icon={ChartBar}
            title="Analytics"
            description="Connect rate, containment, and cost."
          />
          <QuickLinkCard
            href="/dashboard/calls/agents"
            icon={Robot}
            title="Agents"
            description="Create and manage AI voice agents."
          />
        </div>
      </div>
    </div>
  )
}

function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col justify-between rounded-large border border-grey-20 bg-white p-5 shadow-borders-base transition-colors hover:border-grey-30 hover:bg-grey-5"
      )}
    >
      <div>
        <div className="mb-3 flex items-center gap-2 text-grey-90">
          <Icon className="h-5 w-5" />
          <h4 className="font-semibold">{title}</h4>
        </div>
        <p className="text-sm text-grey-50">{description}</p>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-grey-70 group-hover:text-grey-90">
        Open <ArrowUpRightOnBox className="h-4 w-4" />
      </div>
    </Link>
  )
}
