"use client"

import { useEffect, useState } from "react"
import { ExclamationCircle, Plus } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listClaims,
  listOrders,
  getOrder,
  createClaim,
  Claim,
  Order,
  OrderItem,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

const columns: Column<Claim>[] = [
  {
    key: "display_id",
    header: "Claim #",
    render: (c) => <span className="font-medium text-grey-90">#{c.display_id}</span>,
  },
  {
    key: "order_display_id",
    header: "Order #",
    render: (c) => <span className="text-grey-90">#{c.order_display_id || "—"}</span>,
  },
  {
    key: "type",
    header: "Type",
    render: (c) => <span className="capitalize text-grey-90">{c.type || "—"}</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (c) => <span className="text-grey-60">{formatDate(c.created_at)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (c) => <StatusBadge status={c.status} />,
  },
  {
    key: "refund_amount",
    header: "Refund",
    className: "text-right",
    render: (c) => (
      <span className="font-medium text-grey-90">
        {c.refund_amount ? formatMoney(c.refund_amount, "USD") : "—"}
      </span>
    ),
  },
]

export default function ClaimsPage() {
  const { token, logout } = useMerchantAuth()

  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Create flow.
  const [createOpen, setCreateOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [claimType, setClaimType] = useState<"refund" | "replace">("refund")
  const [submitting, setSubmitting] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function loadClaims() {
    if (!token) return
    setLoading(true)
    setError(null)
    listClaims(token)
      .then((r) => setClaims(r.claims || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load claims")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadClaims()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function openCreate() {
    if (!token) return
    setSelectedOrderId("")
    setOrderItems([])
    setSelectedItems({})
    setClaimType("refund")
    setCreateOpen(true)
    try {
      const r = await listOrders(token)
      setOrders(r.orders || [])
    } catch {
      // Non-fatal; the select simply stays empty.
    }
  }

  async function handleSelectOrder(orderId: string) {
    setSelectedOrderId(orderId)
    setOrderItems([])
    setSelectedItems({})
    if (!token || !orderId) return
    setItemsLoading(true)
    try {
      const r = await getOrder(token, orderId)
      setOrderItems(r.order.items || [])
      const initial: Record<string, number> = {}
      for (const item of r.order.items || []) initial[item.id] = 0
      setSelectedItems(initial)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load order items")
    } finally {
      setItemsLoading(false)
    }
  }

  function getSelectedItems() {
    return Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => ({ id, quantity }))
  }

  async function handleCreate() {
    if (!token || !selectedOrderId) return
    const items = getSelectedItems()
    if (!items.length) return
    setSubmitting(true)
    try {
      await createClaim(token, { order_id: selectedOrderId, type: claimType, items })
      showMessage("success", "Claim created.")
      setCreateOpen(false)
      loadClaims()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Claim creation failed")
    } finally {
      setSubmitting(false)
    }
  }

  const createButton = (
    <button
      onClick={openCreate}
      className="flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2.5 text-sm font-medium text-white hover:bg-grey-80"
    >
      <Plus className="h-4 w-4" />
      Create claim
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claims"
        description="Track and file claims for damaged or incorrect items."
        action={createButton}
      />

      {message && (
        <div
          className={
            message.type === "success"
              ? "rounded-base bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
        >
          {message.text}
        </div>
      )}

      {error && !claims.length ? (
        <EmptyState
          icon={ExclamationCircle}
          title="Could not load claims"
          description={error}
          action={createButton}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={claims}
          searchKeys={["display_id", "order_display_id", "type"]}
          pageSize={15}
          isLoading={loading}
          emptyIcon={ExclamationCircle}
          emptyTitle="No claims"
          emptyDescription="Create a claim from an order to get started."
          emptyAction={createButton}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create claim"
        description="Choose an order, then select the items and quantities to claim."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-grey-70">Order</label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleSelectOrder(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
            >
              <option value="">Select an order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.display_id} — {o.customer_name || o.email || "Guest"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-grey-90">
              <input
                type="radio"
                value="refund"
                checked={claimType === "refund"}
                onChange={() => setClaimType("refund")}
              />
              Refund
            </label>
            <label className="flex items-center gap-2 text-sm text-grey-90">
              <input
                type="radio"
                value="replace"
                checked={claimType === "replace"}
                onChange={() => setClaimType("replace")}
              />
              Replace
            </label>
          </div>

          {itemsLoading ? (
            <div className="h-24 animate-pulse rounded-base bg-grey-10" />
          ) : orderItems.length > 0 ? (
            <div className="space-y-2">
              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-base border border-grey-20 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-grey-90">{item.title}</p>
                    {item.variant_title && <p className="text-xs text-grey-50">{item.variant_title}</p>}
                    <p className="text-xs text-grey-50">Available: {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={selectedItems[item.id] ?? 0}
                    onChange={(e) =>
                      setSelectedItems((prev) => ({
                        ...prev,
                        [item.id]: Math.min(item.quantity, Math.max(0, Number(e.target.value))),
                      }))
                    }
                    className="w-20 rounded-base border border-grey-30 px-2 py-1.5 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          ) : selectedOrderId ? (
            <p className="text-sm text-grey-50">This order has no items.</p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedOrderId || !getSelectedItems().length || submitting}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create claim"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
