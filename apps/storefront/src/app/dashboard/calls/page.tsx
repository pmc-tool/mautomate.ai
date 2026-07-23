"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRightOnBox,
  Bolt,
  BookOpen,
  Calendar,
  ChartBar,
  ChatBubbleLeftRight,
  Clock,
  DocumentText,
  Phone,
  Robot,
  Sparkles,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterDashboard,
  type CallCenterDashboard,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { cn } from "@lib/util/cn"

const QUICK_LINKS = [
  {
    href: "/dashboard/calls/campaigns",
    icon: Bolt,
    title: "Campaigns",
    description: "View outbound campaigns and their status.",
  },
  {
    href: "/dashboard/calls/calls",
    icon: DocumentText,
    title: "Calls",
    description: "Browse call history and outcomes.",
  },
  {
    href: "/dashboard/calls/playbooks",
    icon: BookOpen,
    title: "Playbooks",
    description: "Conversation scripts and versions.",
  },
  {
    href: "/dashboard/calls/analytics",
    icon: ChartBar,
    title: "Analytics",
    description: "Connect rate, containment, and credit usage.",
  },
  {
    href: "/dashboard/calls/agents",
    icon: Robot,
    title: "Agents",
    description: "Create and manage AI voice agents.",
  },
  {
    href: "/dashboard/calls/numbers",
    icon: Phone,
    title: "Phone numbers",
    description: "Buy a number and attach it to an agent.",
  },
]

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

  const creditsToday = Number(
    (dashboard as any)?.credits_today ?? dashboard?.total_cost ?? 0
  )

  const statusEntries = dashboard
    ? Object.entries(dashboard.calls_today.by_status)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Center"
        description="Voice campaigns, calls, and analytics for your store."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/calls/analytics"
              className="inline-flex items-center justify-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
            >
              <ChartBar className="h-4 w-4" /> Analytics
            </Link>
            <Link
              href="/dashboard/calls/campaigns"
              className="inline-flex items-center justify-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              <Bolt className="h-4 w-4" /> Campaigns
            </Link>
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Calls today"
          value={dashboard?.calls_today.total ?? 0}
          icon={ChatBubbleLeftRight}
          chip="bg-sky-50 text-sky-600"
          loading={loading}
        />
        <StatTile
          label="Connected today"
          value={connectedToday}
          icon={Phone}
          chip="bg-emerald-50 text-emerald-600"
          loading={loading}
        />
        <StatTile
          label="Running campaigns"
          value={dashboard?.campaigns_running ?? 0}
          icon={Bolt}
          chip="bg-violet-50 text-violet-600"
          loading={loading}
        />
        <StatTile
          label="Credits spent today"
          value={`${creditsToday.toLocaleString()} credits`}
          icon={Sparkles}
          chip="bg-amber-50 text-amber-600"
          loading={loading}
        />
      </div>

      <section className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-grey-90">Call status today</h3>
          <div className="flex items-center gap-4 text-xs text-grey-50">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-grey-40" />
              {loading ? "—" : dashboard?.total_minutes ?? 0} min talk time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-grey-40" />
              {loading ? "—" : dashboard?.tasks_scheduled ?? 0} scheduled tasks
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-28 animate-pulse rounded-base bg-grey-10"
              />
            ))
          ) : statusEntries.length === 0 ? (
            <p className="text-sm text-grey-50">
              No calls yet today. They will show up here as your agents pick up.
            </p>
          ) : (
            statusEntries.map(([status, count]) => (
              <div
                key={status}
                className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm shadow-borders-base"
              >
                <StatusBadge status={status} />
                <span className="font-medium tabular-nums text-grey-90">{count}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-grey-90">Quick links</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.href} {...link} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  chip,
  loading,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  chip: string
  loading?: boolean
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-grey-50">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-6 w-20 animate-pulse rounded-base bg-grey-10" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-grey-90">
              {value}
            </p>
          )}
        </div>
        <div className={cn("shrink-0 rounded-base p-2", chip)}>
          <Icon className="h-5 w-5" />
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
      className="group flex flex-col rounded-large border border-grey-20 bg-white p-5 shadow-borders-base transition-all hover:-translate-y-0.5 hover:border-grey-40"
    >
      <div className="flex items-start justify-between">
        <span className="rounded-base bg-grey-10 p-2 text-grey-60 transition-colors group-hover:bg-grey-90 group-hover:text-white">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRightOnBox className="h-4 w-4 text-grey-30 transition-colors group-hover:text-grey-60" />
      </div>
      <h4 className="mt-4 text-sm font-semibold text-grey-90">{title}</h4>
      <p className="mt-1 text-sm text-grey-50">{description}</p>
    </Link>
  )
}
