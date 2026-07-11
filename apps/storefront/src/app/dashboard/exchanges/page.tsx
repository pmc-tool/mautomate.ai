"use client"

import { useEffect, useState } from "react"
import { Swatch, Plus } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listExchanges,
  listOrders,
  getOrder,
  createExchange,
  Exchange,
  Order,
  OrderItem,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

const columns: Column<Exchange>[] = [
  {
    key: "display_id",
    header: "Exchange #",
    render: (e) => <span className="font-medium text-grey-90">#{e.display_id}</span>,
  },
  {
    key: "order_display_id",
    header: "Order #",
    render: (e) => <span className="text-grey-90">#{e.order_display_id || "—"}</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (e) => <span className="text-grey-60">{formatDate(e.created_at)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (e) => <StatusBadge status={e.status} />,
  },
  {
    key: "difference_due",
    header: "Difference due",
    className: "text-right",
    render: (e) => (
      <span className="font-medium text-grey-90">
        {typeof e.difference_due === "number" ? formatMoney(e.difference_due, "USD") : "—"}
      </span>
    ),
  },
]

export default function ExchangesPage() {
  const { token, logout } = useMerchantAuth()

  const [exchanges, setExchanges] = useState<Exchange[]>([])
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
  const [submitting, setSubmitting] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function loadExchanges() {
    if (!token) return
    setLoading(true)
    setError(null)
    listExchanges(token)
      .then((r) => setExchanges(r.exchanges || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load exchanges")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadExchanges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function openCreate() {
    if (!token) return
    setSelectedOrderId("")
    setOrderItems([])
    setSelectedItems({})
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
      await createExchange(token, { order_id: selectedOrderId, items })
      showMessage("success", "Exchange created.")
      setCreateOpen(false)
      loadExchanges()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Exchange creation failed")
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
      Create exchange
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchanges"
        description="Swap ordered items for different variants or products."
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

      {error && !exchanges.length ? (
        <EmptyState
          icon={Swatch}
          title="Could not load exchanges"
          description={error}
          action={createButton}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={exchanges}
          searchKeys={["display_id", "order_display_id"]}
          pageSize={15}
          isLoading={loading}
          emptyIcon={Swatch}
          emptyTitle="No exchanges"
          emptyDescription="Create an exchange from an order to get started."
          emptyAction={createButton}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create exchange"
        description="Choose an order, then select the items and quantities to exchange."
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
              {submitting ? "Creating..." : "Create exchange"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
