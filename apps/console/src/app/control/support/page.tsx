"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ChatBubbleLeftRight,
  CheckCircle,
  Envelope,
  ExclamationCircle,
  Eye,
  InboxSolid,
  Trash,
  XCircle,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  deleteTicket,
  getTicket,
  listTickets,
  updateTicketStatus,
  type SupportTicket,
  type SupportTicketDetail,
  type SupportTicketStatus,
} from "@/lib/api/support"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | SupportTicketStatus

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
]

const searchKeys: (keyof SupportTicket)[] = [
  "subject",
  "name",
  "email",
  "tenant_id",
]

function formatValue(value: string | null | undefined): string {
  return value ?? "—"
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function previewMessage(message: string | null | undefined, max = 80): string {
  if (!message) return "—"
  if (message.length <= max) return message
  return `${message.slice(0, max).trim()}…`
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wider text-grey-40 sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-sm text-grey-90">
        {children}
      </dd>
    </div>
  )
}

export default function SupportPage() {
  const { token } = useControlAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Detail view state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    ticket: SupportTicket | null
  }>({ open: false, ticket: null })

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const status = statusFilter === "all" ? undefined : statusFilter
      const res = await listTickets(token, status)
      setTickets(res.tickets)
      setOpenCount(res.open)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = useCallback(
    async (ticket: SupportTicket) => {
      if (!token) return
      setDetailOpen(true)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      try {
        const res = await getTicket(token, ticket.id)
        setDetail(res.ticket)
      } catch (err) {
        // Degrade gracefully: the list row already carries the full message.
        setDetail({
          ...ticket,
          created_at: "",
          updated_at: "",
        })
        setDetailError(
          err instanceof Error
            ? err.message
            : "Could not load full ticket detail"
        )
      } finally {
        setDetailLoading(false)
      }
    },
    [token]
  )

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setDetailError(null)
  }

  const handleToggleStatus = async (ticket: SupportTicket) => {
    if (!token) return
    const nextStatus = ticket.status === "open" ? "closed" : "open"
    setWorkingId(ticket.id)
    try {
      await updateTicketStatus(token, ticket.id, nextStatus)
      if (detail && detail.id === ticket.id) {
        setDetail({ ...detail, status: nextStatus })
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket")
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteModal.ticket) return
    setWorkingId(deleteModal.ticket.id)
    try {
      await deleteTicket(token, deleteModal.ticket.id)
      if (detail && detail.id === deleteModal.ticket.id) closeDetail()
      await load()
      setDeleteModal({ open: false, ticket: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket")
    } finally {
      setWorkingId(null)
    }
  }

  const columns = useMemo<Column<SupportTicket>[]>(
    () => [
      {
        key: "subject",
        header: "Subject",
        render: (row) => (
          <button
            onClick={() => openDetail(row)}
            className="text-left font-medium text-grey-90 outline-none hover:text-grey-60 hover:underline focus-visible:underline"
          >
            {formatValue(row.subject)}
          </button>
        ),
      },
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <span className="text-grey-70">{formatValue(row.name)}</span>
        ),
      },
      {
        key: "email",
        header: "Email",
        render: (row) => (
          <span className="text-grey-70">{formatValue(row.email)}</span>
        ),
      },
      {
        key: "source",
        header: "Source",
        render: (row) => (
          <span className="inline-flex items-center rounded-base border border-grey-20 bg-grey-5 px-2 py-1 text-xs font-medium text-grey-70 capitalize">
            {row.source ?? "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "tenant_id",
        header: "Tenant ID",
        render: (row) => (
          <span className="text-grey-70">{formatValue(row.tenant_id)}</span>
        ),
      },
      {
        key: "message",
        header: "Message preview",
        render: (row) => (
          <button
            onClick={() => openDetail(row)}
            className="max-w-xs truncate text-left text-grey-50 outline-none hover:text-grey-70 hover:underline focus-visible:underline"
            title={row.message}
          >
            {previewMessage(row.message)}
          </button>
        ),
      },
    ],
    [openDetail]
  )

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"

  const emptyTitle = statusFilter === "open"
    ? "No open tickets"
    : statusFilter === "closed"
    ? "No closed tickets"
    : "No tickets yet"

  const emptyDescription = statusFilter === "all"
    ? "Support requests and contact submissions will appear here."
    : `There are no ${statusFilter} tickets matching your filter.`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Inbox"
        description="Review and manage platform support tickets and contact submissions."
        action={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
          >
            <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Open tickets"
          value={openCount}
          icon={ChatBubbleLeftRight}
          tone="brand"
        />
        <KpiCard
          label="Total tickets"
          value={tickets.length}
          icon={Envelope}
          tone="grey"
        />
      </div>

      <div className="flex items-center gap-1 rounded-large border border-grey-20 bg-white p-1 shadow-borders-base w-fit">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              "rounded-base px-4 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20",
              statusFilter === filter.value
                ? "bg-grey-90 text-white"
                : "text-grey-70 hover:bg-grey-10 hover:text-grey-90"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={tickets}
          searchKeys={searchKeys}
          isLoading={loading}
          emptyIcon={InboxSolid}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          rowActions={(row) => [
            <button
              key={`view-${row.id}`}
              onClick={() => openDetail(row)}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </button>,
            <button
              key={`toggle-${row.id}`}
              onClick={() => handleToggleStatus(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                row.status === "open"
                  ? "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
              )}
            >
              {row.status === "open" ? (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Close
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Reopen
                </>
              )}
            </button>,
            <button
              key={`delete-${row.id}`}
              onClick={() => setDeleteModal({ open: true, ticket: row })}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
              )}
            >
              <Trash className="h-3.5 w-3.5" />
            </button>,
          ]}
        />
      </div>

      {/* Ticket detail */}
      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={detail ? formatValue(detail.subject) : "Ticket"}
        description={
          detail
            ? `${detail.source} · ${detail.name || detail.email || "Unknown sender"}`
            : undefined
        }
        size="lg"
      >
        {detailLoading && !detail ? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-grey-10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-grey-10" />
            <div className="h-32 w-full animate-pulse rounded bg-grey-10" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {detailError && (
              <div className="rounded-base border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {detailError}
              </div>
            )}

            <dl className="space-y-3">
              <DetailRow label="From">
                {formatValue(detail.name)}
              </DetailRow>
              <DetailRow label="Email">
                {detail.email ? (
                  <a
                    href={`mailto:${detail.email}`}
                    className="text-sky-700 hover:underline"
                  >
                    {detail.email}
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={detail.status} />
              </DetailRow>
              <DetailRow label="Source">
                <span className="capitalize">{detail.source}</span>
              </DetailRow>
              <DetailRow label="Tenant ID">
                {formatValue(detail.tenant_id)}
              </DetailRow>
              {detail.created_at && (
                <DetailRow label="Received">
                  {formatDateTime(detail.created_at)}
                </DetailRow>
              )}
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-grey-40">
                Message
              </h3>
              <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-large border border-grey-20 bg-grey-5 p-4 text-sm leading-relaxed text-grey-90">
                {detail.message || "—"}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-grey-10 pt-4">
              <button
                onClick={() => handleToggleStatus(detail)}
                disabled={workingId === detail.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-base border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50",
                  detail.status === "open"
                    ? "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
                    : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                )}
              >
                {detail.status === "open" ? (
                  <>
                    <XCircle className="h-4 w-4" />
                    Close ticket
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Reopen ticket
                  </>
                )}
              </button>
              <button
                onClick={closeDetail}
                className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, ticket: null })}
        title="Delete ticket"
        description={
          deleteModal.ticket
            ? `Delete ticket from "${deleteModal.ticket.name || deleteModal.ticket.email || "Unknown"}"? This cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, ticket: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={workingId === deleteModal.ticket?.id}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
