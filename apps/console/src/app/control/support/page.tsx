"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ChatBubbleLeftRight,
  CheckCircle,
  Envelope,
  ExclamationCircle,
  InboxSolid,
  Trash,
  XCircle,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  deleteTicket,
  listTickets,
  updateTicketStatus,
  type SupportTicket,
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

function previewMessage(message: string | null | undefined, max = 80): string {
  if (!message) return "—"
  if (message.length <= max) return message
  return `${message.slice(0, max).trim()}…`
}

export default function SupportPage() {
  const { token } = useControlAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

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

  const handleToggleStatus = async (ticket: SupportTicket) => {
    if (!token) return
    const nextStatus = ticket.status === "open" ? "closed" : "open"
    setWorkingId(ticket.id)
    try {
      await updateTicketStatus(token, ticket.id, nextStatus)
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
          <div>
            <p className="font-medium text-grey-90">{formatValue(row.subject)}</p>
          </div>
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
          <span className="max-w-xs truncate text-grey-50" title={row.message}>
            {previewMessage(row.message)}
          </span>
        ),
      },
    ],
    []
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
