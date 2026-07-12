"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Funnel,
  MagnifyingGlass,
  PencilSquare,
  ReceiptPercent,
  Trash,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"
import {
  listPromotions,
  deletePromotion,
  PromotionListItem,
  ApiError,
} from "../../../lib/merchant-admin/api"

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

// Medusa PromotionStatus badge colors: draft = grey, active = green, inactive = red.
const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-grey-10 text-grey-70" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800" },
  inactive: { label: "Inactive", className: "bg-rose-50 text-rose-800" },
}

function PromotionStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status ? status.replace(/_/g, " ") : "-",
    className: "bg-grey-10 text-grey-70",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  )
}

function PromotionValue({ promotion }: { promotion: PromotionListItem }) {
  if (promotion.value == null) {
    return <span className="text-grey-50">-</span>
  }
  if (promotion.value_type === "percentage") {
    return <span className="text-grey-90">{promotion.value}%</span>
  }
  if (promotion.currency_code) {
    return (
      <span className="text-grey-90">
        {formatMoney(promotion.value, promotion.currency_code)}
      </span>
    )
  }
  return <span className="text-grey-90">{promotion.value}</span>
}

export default function PromotionsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [items, setItems] = useState<PromotionListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [offset, setOffset] = useState(0)

  const [deleteTarget, setDeleteTarget] = useState<PromotionListItem | null>(null)
  const [verifyText, setVerifyText] = useState("")
  const [deleting, setDeleting] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // Debounced search -> server-side q param, resetting to the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput.trim())
      setOffset(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [qInput])

  async function load() {
    if (!token) return
    setFetching(true)
    setError(null)
    try {
      const res = await listPromotions(token, {
        q: q || undefined,
        status: status ? [status] : undefined,
        limit: PAGE_SIZE,
        offset,
      })
      setItems(res.promotions || [])
      setCount(res.count || 0)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load promotions")
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, q, status, offset])

  function openDelete(promotion: PromotionListItem) {
    setVerifyText("")
    setDeleteTarget(promotion)
  }

  function closeDelete() {
    if (deleting) return
    setDeleteTarget(null)
    setVerifyText("")
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return
    if (verifyText !== deleteTarget.display_code) return
    setDeleting(true)
    try {
      await deletePromotion(token, deleteTarget.id)
      showMessage("success", `Promotion ${deleteTarget.display_code} deleted.`)
      setDeleteTarget(null)
      setVerifyText("")
      if (items.length === 1 && offset > 0) {
        setOffset((o) => Math.max(0, o - PAGE_SIZE))
      } else {
        await load()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to delete promotion")
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<PromotionListItem>[] = [
    {
      key: "display_code",
      header: "Code",
      render: (p) =>
        p.display_code ? (
          <span className="inline-flex items-center rounded-base bg-grey-10 px-2 py-0.5 font-mono text-xs text-grey-90">
            {p.display_code}
          </span>
        ) : (
          <span className="text-grey-50">-</span>
        ),
    },
    {
      key: "method",
      header: "Method",
      render: (p) => (
        <span className="text-grey-70">
          {p.is_automatic ? "Automatic" : "Promotion code"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <PromotionStatusBadge status={p.status} />,
    },
    {
      key: "value",
      header: "Value",
      render: (p) => <PromotionValue promotion={p} />,
    },
    {
      key: "campaign",
      header: "Campaign",
      render: (p) =>
        p.campaign?.name ? (
          <span className="text-grey-90">{p.campaign.name}</span>
        ) : (
          <span className="text-grey-50">-</span>
        ),
    },
  ]

  const hasFilters = Boolean(q || status)
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, count)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Manage discount codes and automatic promotions for your store."
        action={
          <button
            onClick={() => router.push("/dashboard/promotions/create")}
            className="inline-flex items-center rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
          >
            Create
          </button>
        }
      />

      {message && (
        <div
          className={cn(
            "rounded-base border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {message.text}
        </div>
      )}

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
          />
        </div>
        <div className="relative sm:w-48">
          <Funnel className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
            }}
            className="w-full appearance-none rounded-base border border-grey-20 bg-white py-2 pl-9 pr-8 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn("transition-opacity", fetching && !loading && "opacity-60")}>
        <DataTable<PromotionListItem>
          columns={columns}
          rows={items}
          onRowClick={(p) => router.push(`/dashboard/promotions/${p.id}`)}
          rowActions={(p) => (
            <div onClick={(e) => e.stopPropagation()}>
              <ActionMenu
                items={[
                  {
                    label: "Edit",
                    icon: PencilSquare,
                    onClick: () => router.push(`/dashboard/promotions/${p.id}`),
                  },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: () => openDelete(p),
                  },
                ]}
              />
            </div>
          )}
          emptyIcon={ReceiptPercent}
          emptyTitle={hasFilters ? "No results" : "No records"}
          emptyDescription={
            hasFilters
              ? "Try changing the filters or search query"
              : "There are no records to show"
          }
          isLoading={loading}
          pageSize={PAGE_SIZE}
        />
      </div>

      {!loading && count > 0 && (
        <div className="flex items-center justify-between rounded-large border border-grey-20 bg-white px-4 py-3 shadow-borders-base">
          <p className="text-xs text-grey-50">
            Showing {from}&ndash;{to} of {count}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={fetching || currentPage === 1}
              aria-label="Previous page"
              className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-grey-60">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setOffset((o) => (o + PAGE_SIZE < count ? o + PAGE_SIZE : o))
              }
              disabled={fetching || currentPage >= totalPages}
              aria-label="Next page"
              className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <Modal
          open
          onClose={closeDelete}
          title="Are you sure?"
          description={`You are about to delete the promotion ${deleteTarget.display_code}. This action cannot be undone.`}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-grey-70">
                Please type{" "}
                <span className="font-medium text-grey-90">
                  {deleteTarget.display_code}
                </span>{" "}
                to confirm:
              </p>
              <input
                type="text"
                value={verifyText}
                onChange={(e) => setVerifyText(e.target.value)}
                autoFocus
                placeholder={deleteTarget.display_code}
                className="mt-2 w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || verifyText !== deleteTarget.display_code}
                className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
