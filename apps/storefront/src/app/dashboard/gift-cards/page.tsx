"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CubeSolid, PencilSquare, Plus, Trash, Photo } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listGiftCards,
  deleteGiftCard,
  GiftCard,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"

export default function GiftCardsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<GiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGiftCards = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listGiftCards(token)
      setItems(res.gift_cards || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load gift cards")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGiftCards()
  }, [token, logout])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm("Are you sure you want to delete this gift card product?")) return
    try {
      await deleteGiftCard(token, id)
      await loadGiftCards()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete gift card")
    }
  }

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(items.map((g) => g.status))).sort()
    return statuses.map((s) => ({ value: s, label: s }))
  }, [items])

  const columns = [
    {
      key: "thumbnail",
      header: "",
      className: "w-14",
      render: (g: GiftCard) =>
        g.thumbnail ? (
          <img src={g.thumbnail} alt="" className="h-10 w-10 rounded-base object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-base bg-grey-10">
            <Photo className="h-5 w-5 text-grey-40" />
          </div>
        ),
    },
    { key: "title", header: "Title", sortable: true },
    { key: "handle", header: "Handle", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (g: GiftCard) => <StatusBadge status={g.status} />,
    },
    {
      key: "price",
      header: "Price",
      render: (g: GiftCard) =>
        g.price != null && g.currency_code ? (
          <span className="text-grey-90">{formatMoney(g.price, g.currency_code)}</span>
        ) : (
          <span className="text-grey-50">-</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gift cards"
        description="Manage gift card products."
        action={
          <button
            onClick={() => router.push("/dashboard/gift-cards/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Add gift card
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<GiftCard>
        columns={columns}
        rows={items}
        searchKeys={["title", "handle"]}
        filterKey="status"
        filterOptions={statusOptions}
        sortKeys={[
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
        ]}
        rowActions={(g) => (
          <>
            <button
              onClick={() => router.push(`/dashboard/gift-cards/${g.id}`)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(g.id)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={CubeSolid}
        emptyTitle="No gift cards yet"
        emptyDescription="Get started by adding your first gift card product."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/gift-cards/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Add gift card
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
