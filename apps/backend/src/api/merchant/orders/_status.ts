// Medusa's computed order.payment_status / fulfillment_status come back
// undefined through query.graph, so we derive them from the underlying payment
// collections and the fulfillments. Used by the list + detail order routes so
// statuses render consistently instead of "Unknown".
//
// IMPORTANT: do NOT derive from order.items.detail.* — requesting those fields
// in a LIST query makes the order module try to load line-item adjustments and
// throws "Item version is required to load adjustments" (500). Fulfillment
// status is derived purely from the fulfillments array, which is safe.

export function paymentStatusFrom(pcs: any[]): string {
  const st = (pcs || []).map((p) => p?.status).filter(Boolean)
  if (!st.length) return "not_paid"
  if (st.every((s) => s === "captured")) return "captured"
  if (st.some((s) => s === "captured" || s === "partially_captured")) return "partially_captured"
  if (st.some((s) => s === "refunded")) return "refunded"
  if (st.some((s) => s === "authorized")) return "authorized"
  if (st.some((s) => s === "partially_authorized")) return "partially_authorized"
  if (st.some((s) => s === "awaiting")) return "awaiting"
  if (st.every((s) => s === "canceled")) return "canceled"
  return "not_paid"
}

export function fulfillmentStatusFrom(fulfillments: any[]): string {
  const all = fulfillments || []
  const active = all.filter((f: any) => !f.canceled_at)
  if (active.length === 0) {
    return all.length > 0 ? "canceled" : "not_fulfilled"
  }
  if (active.every((f: any) => f.delivered_at)) return "delivered"
  if (active.every((f: any) => f.shipped_at || f.delivered_at)) return "shipped"
  return "fulfilled"
}
