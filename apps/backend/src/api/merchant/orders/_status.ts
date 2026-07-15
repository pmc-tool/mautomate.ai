// Medusa's computed order.payment_status / fulfillment_status come back
// undefined through query.graph, so we derive them from the underlying payment
// collections and the fulfillments. Used by the list + detail order routes so
// statuses render consistently instead of "Unknown".
//
// IMPORTANT: do NOT derive from order.items.detail.* — requesting those fields
// in a LIST query makes the order module try to load line-item adjustments and
// throws "Item version is required to load adjustments" (500). Fulfillment
// status is derived purely from the fulfillments array, which is safe.

// "completed" is a PAID collection — it is what Medusa writes on a collection
// that has been captured in full, and what a normal checkout leaves behind. It
// was missing from this ladder, so every fully-paid order fell through to the
// final `return "not_paid"` and the dashboard labelled it unpaid. The same
// omission in the call-center gateway is why the AI agent told a customer whose
// parcel had already shipped that his payment had never arrived.
const PAID = (s: string) => s === "captured" || s === "completed"

export function paymentStatusFrom(pcs: any[]): string {
  const st = (pcs || []).map((p) => p?.status).filter(Boolean)
  if (!st.length) return "not_paid"
  if (st.every(PAID)) return "captured"
  if (st.some((s) => PAID(s) || s === "partially_captured")) return "partially_captured"
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

/**
 * The order's REAL money and quantities, read from the tables that actually hold
 * them.
 *
 * Medusa's computed order fields come off the order's line items, but an order's
 * quantity does not live on the line item — it lives on `order_item`, the
 * VERSIONED join. Through query.graph those quantities come back as 0, so
 * `item_total` computes to 0 and `total` collapses to shipping alone: a real
 * order of 4 x $1,000 + $500 shipping was reported as **$500**, and its line
 * rendered as "0 x Sample Product".
 *
 * The authoritative figures are `order_summary` (latest version) for the totals
 * and `order_item` (latest version) for the quantities. Read those.
 *
 * Batched — two queries for any number of orders — and best-effort: if it fails,
 * callers keep whatever the graph gave them.
 */
export type OrderMoney = {
  total: number | null
  paid_total: number | null
  pending_difference: number | null
  /** line item id -> the quantity actually ordered */
  quantities: Map<string, number>
}

export async function orderMoneyFor(
  pg: any,
  orderIds: string[]
): Promise<Map<string, OrderMoney>> {
  const out = new Map<string, OrderMoney>()
  if (!pg || !orderIds.length) {
    return out
  }
  try {
    const [summaries, items] = await Promise.all([
      pg
        .select("order_id", "totals")
        .from("order_summary")
        .distinctOn("order_id")
        .whereIn("order_id", orderIds)
        .whereNull("deleted_at")
        .orderBy([{ column: "order_id" }, { column: "version", order: "desc" }]),
      pg
        .select("order_id", "item_id", "quantity")
        .from("order_item as oi")
        .whereIn("oi.order_id", orderIds)
        .whereNull("oi.deleted_at")
        .andWhereRaw(
          "oi.version = (select max(version) from order_item x where x.order_id = oi.order_id)"
        ),
    ])

    const num = (v: any): number | null =>
      v == null || Number.isNaN(Number(v)) ? null : Number(v)

    for (const row of Array.isArray(summaries) ? summaries : []) {
      const t = row.totals ?? {}
      out.set(String(row.order_id), {
        total: num(t.current_order_total),
        paid_total: num(t.paid_total),
        pending_difference: num(t.pending_difference),
        quantities: new Map(),
      })
    }
    for (const row of Array.isArray(items) ? items : []) {
      const key = String(row.order_id)
      const entry =
        out.get(key) ??
        ({
          total: null,
          paid_total: null,
          pending_difference: null,
          quantities: new Map(),
        } as OrderMoney)
      entry.quantities.set(String(row.item_id), Number(row.quantity) || 0)
      out.set(key, entry)
    }
  } catch {
    // Best-effort: the caller falls back to the graph's figures.
  }
  return out
}
