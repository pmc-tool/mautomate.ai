"use client"

import { useEffect, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listOrders, Order, ApiError } from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

export function OrdersView() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listOrders(token)
      .then((r) => setItems(r.orders || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load orders")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-grey-90">Orders</h2>
      {loading && <p className="text-grey-50">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="bg-white border border-grey-20 rounded-large overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-grey-10 text-grey-70">
              <tr>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Payment</th>
                <th className="text-left px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {items.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 text-grey-90">#{o.display_id}</td>
                  <td className="px-4 py-3 text-grey-60">{o.status}</td>
                  <td className="px-4 py-3 text-grey-60">{o.payment_status}</td>
                  <td className="px-4 py-3 text-grey-90">{formatMoney(o.total, o.currency_code)}</td>
                  <td className="px-4 py-3 text-grey-60">{formatDate(o.created_at)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-grey-50" colSpan={5}>
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
