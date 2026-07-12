"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  ExclamationCircle,
  MagnifyingGlass,
  PencilSquare,
  Plus,
  Sparkles,
  Trash,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import type { Column } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"
import {
  listCampaigns,
  deleteCampaign,
  CampaignListItem,
  ApiError,
} from "../../../lib/merchant-admin/api"

const PAGE_SIZE = 20

function formatBudget(campaign: CampaignListItem): string {
  const budget = campaign.budget
  if (!budget) return "—"
  if (budget.type === "spend") {
    const currency = budget.currency_code || ""
    const used = currency
      ? formatMoney(budget.used ?? 0, currency)
      : String(budget.used ?? 0)
    const cap =
      budget.limit != null
        ? currency
          ? formatMoney(budget.limit, currency)
          : String(budget.limit)
        : "no limit"
    return `${used} / ${cap}`
  }
  return `${budget.used ?? 0} / ${budget.limit != null ? budget.limit : "no limit"}`
}

export default function CampaignsPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [items, setItems] = useState<CampaignListItem[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CampaignListItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  const requestId = useRef(0)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return
      const id = ++requestId.current
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const res = await listCampaigns(token, {
          q: query || undefined,
          offset,
          limit: PAGE_SIZE,
        })
        if (id !== requestId.current) return
        setItems(res.campaigns || [])
        setCount(res.count || 0)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout()
        if (id !== requestId.current) return
        setError(err instanceof Error ? err.message : "Failed to load campaigns")
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [token, query, offset, logout]
  )

  useEffect(() => {
    load()
  }, [load])

  // Debounced server-side search. Resets to the first page on change.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery((prev) => {
        const next = searchInput.trim()
        if (next !== prev) setOffset(0)
        return next
      })
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  function closeDeleteModal() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirm("")
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return
    if (deleteConfirm !== deleteTarget.name) return
    setDeleting(true)
    try {
      await deleteCampaign(token, deleteTarget.id)
      showMessage(
        "success",
        `Campaign '${deleteTarget.name}' was successfully deleted.`
      )
      setDeleteTarget(null)
      setDeleteConfirm("")
      if (items.length === 1 && offset > 0) {
        // Deleted the last row on this page: step back one page (triggers reload).
        setOffset((o) => Math.max(0, o - PAGE_SIZE))
      } else {
        await load({ silent: true })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to delete campaign"
      )
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<CampaignListItem>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => <span className="font-medium text-grey-90">{c.name}</span>,
    },
    {
      key: "campaign_identifier_display",
      header: "Identifier",
      render: (c) => (
        <span className="text-grey-60">{c.campaign_identifier_display || "—"}</span>
      ),
    },
    {
      key: "starts_at",
      header: "Start date",
      render: (c) => (
        <span className="text-grey-60">
          {c.starts_at ? formatDate(c.starts_at) : "—"}
        </span>
      ),
    },
    {
      key: "ends_at",
      header: "End date",
      render: (c) => (
        <span className="text-grey-60">
          {c.ends_at ? formatDate(c.ends_at) : "—"}
        </span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      render: (c) => <span className="text-grey-90">{formatBudget(c)}</span>,
    },
    {
      key: "promotions_count",
      header: "Promotions",
      render: (c) => (
        <span className="text-grey-90">{c.promotions_count ?? 0}</span>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.min(Math.floor(offset / PAGE_SIZE) + 1, totalPages)

  const createButton = (
    <button
      onClick={() => router.push("/dashboard/campaigns/create")}
      className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
    >
      <Plus className="h-4 w-4" />
      Create
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Organize promotions under shared dates and a budget."
        action={createButton}
      />

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="relative sm:max-w-xs">
        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
        />
      </div>

      <DataTable<CampaignListItem>
        columns={columns}
        rows={items}
        onRowClick={(c) => router.push(`/dashboard/campaigns/${c.id}`)}
        rowActions={(c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu
              items={[
                {
                  label: "Edit",
                  icon: PencilSquare,
                  onClick: () => router.push(`/dashboard/campaigns/${c.id}`),
                },
                {
                  label: "Delete",
                  icon: Trash,
                  destructive: true,
                  onClick: () => {
                    setDeleteConfirm("")
                    setDeleteTarget(c)
                  },
                },
              ]}
            />
          </div>
        )}
        emptyIcon={Sparkles}
        emptyTitle={query ? "No results" : "No campaigns yet"}
        emptyDescription={
          query
            ? `No campaigns match "${query}".`
            : "Create a campaign to group promotions and track a shared budget."
        }
        emptyAction={!query ? createButton : undefined}
        isLoading={loading}
        pageSize={PAGE_SIZE}
      />

      {!loading && count > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-grey-50">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, count)} of {count}{" "}
            campaigns
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={currentPage === 1}
              className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-grey-60">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setOffset((o) =>
                  Math.min((totalPages - 1) * PAGE_SIZE, o + PAGE_SIZE)
                )
              }
              disabled={currentPage === totalPages}
              className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={closeDeleteModal}
        title="Are you sure?"
        description={
          deleteTarget
            ? `You are about to delete the campaign ${deleteTarget.name}. This action cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="space-y-4">
          <FormField
            label={`Type "${deleteTarget?.name ?? ""}" to confirm`}
            htmlFor="campaign-delete-confirm"
          >
            <Input
              id="campaign-delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget?.name ?? ""}
              autoComplete="off"
              autoFocus
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== (deleteTarget?.name ?? "")}
              className="inline-flex items-center rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
