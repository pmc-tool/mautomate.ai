"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownLeftMini,
  ArrowLeftMini,
  ArrowUpRightMini,
  ChevronRightMini,
  Phone,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCallCenterCalls,
  type CallCenterCall,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { cn } from "@lib/util/cn"

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

/* ------------------------------------------------------------------ helpers */

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

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—"
  const secs = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  )
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function DirectionPill({ direction }: { direction?: string | null }) {
  const inbound = direction === "inbound"
  const Icon = inbound ? ArrowDownLeftMini : ArrowUpRightMini
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        inbound ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {direction || "outbound"}
    </span>
  )
}

function SentimentPill({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return <span className="text-grey-40">—</span>
  const v = sentiment.toLowerCase()
  const positive = ["positive", "happy", "satisfied", "good"].some((k) =>
    v.includes(k)
  )
  const negative = ["negative", "angry", "frustrated", "bad", "upset"].some(
    (k) => v.includes(k)
  )
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        positive
          ? "bg-emerald-50 text-emerald-800"
          : negative
            ? "bg-rose-50 text-rose-800"
            : "bg-grey-10 text-grey-70"
      )}
    >
      {sentiment}
    </span>
  )
}

/* --------------------------------------------------------------------- page */

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
      <Link
        href="/dashboard/calls"
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Call Center
      </Link>

      <PageHeader
        title="Calls"
        description="Every inbound and outbound call your agents handled, with outcome, sentiment, and duration."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: "to_number",
            header: "Number",
            render: (row) => {
              const counterpart =
                row.direction === "inbound"
                  ? row.from_number || row.to_number
                  : row.to_number || row.from_number
              return (
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-grey-90">
                    {counterpart || "Unknown"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-grey-40">
                    {row.id}
                  </p>
                </div>
              )
            },
          },
          {
            key: "direction",
            header: "Direction",
            render: (row) => <DirectionPill direction={row.direction} />,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "disposition",
            header: "Disposition",
            render: (row) =>
              row.disposition ? (
                <span className="capitalize text-grey-70">
                  {row.disposition.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-grey-40">—</span>
              ),
          },
          {
            key: "sentiment",
            header: "Sentiment",
            render: (row) => <SentimentPill sentiment={row.sentiment} />,
          },
          {
            key: "duration",
            header: "Duration",
            className: "whitespace-nowrap",
            render: (row) => (
              <span className="tabular-nums text-grey-70">
                {formatDuration(row.started_at, row.ended_at)}
              </span>
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
          {
            key: "chevron",
            header: "",
            className: "w-10 text-right",
            render: () => (
              <ChevronRightMini className="ml-auto h-4 w-4 text-grey-40" />
            ),
          },
        ]}
        rows={calls}
        onRowClick={(row) => router.push(`/dashboard/calls/calls/${row.id}`)}
        isLoading={loading}
        searchKeys={["id", "to_number", "disposition", "order_id"]}
        filterKey="status"
        filterOptions={callStatuses}
        sortKeys={[{ key: "created_at", label: "Date" }]}
        emptyIcon={Phone}
        emptyTitle="No calls yet"
        emptyDescription="Calls will appear here once an agent answers or a campaign starts dialing."
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
