import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { MARKETING_MODULE } from "../../../modules/marketing"
import type MarketingModuleService from "../../../modules/marketing/service"
import { paymentStatusFrom, orderMoneyFor } from "../orders/_status"
import { getAvailableByVariant } from "../_inventory"

/**
 * Pixi P2 — four more READ-ONLY tools.
 *
 * Same contract as `_tools.ts`: every handler is tenant-scoped through `ctx`
 * (the tenant is NEVER read from the model's arguments) and NEVER throws — a
 * failure returns `{ error }` the model can read and explain, so a broken tool
 * degrades the answer instead of breaking the run. Totals come from
 * `orderMoneyFor`, which reads the authoritative order_summary/order_item tables
 * and hands back whole currency units.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

const pg = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// Payment states that mean the order's money has actually been collected.
const PAID_STATUSES = new Set(["captured", "partially_captured"])

/* ----------------------------- sales summary ----------------------------- */

/**
 * Revenue + orders over the last N days. Revenue and AOV count only orders whose
 * payment is captured (fully or partially) — placed-but-unpaid orders are not
 * money in the bank.
 */
export async function salesSummary(req: MedusaRequest, ctx: Ctx, days = 30) {
  const currency = (ctx.tenant.meta?.currency_code ?? "usd").toUpperCase()
  const window = Math.max(1, Math.min(365, Math.floor(days) || 30))
  try {
    const scId = ctx.tenant.meta?.sales_channel_id
    if (!scId) {
      return { days: window, orders: 0, revenue: 0, aov: 0, currency }
    }
    const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000).toISOString()
    const query = q(req)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "status", "created_at", "payment_collections.status"],
      filters: { sales_channel_id: scId, created_at: { $gte: since } } as any,
      pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } } as any,
    })
    const orders = data || []
    const money = await orderMoneyFor(
      pg(req),
      orders.map((o: any) => o.id)
    )
    let revenue = 0
    let paidCount = 0
    for (const o of orders) {
      if (o.status === "canceled") continue
      const payment = paymentStatusFrom((o as any).payment_collections)
      if (PAID_STATUSES.has(payment)) {
        revenue += money.get(o.id)?.total ?? 0
        paidCount++
      }
    }
    return {
      days: window,
      orders: orders.length,
      revenue: round2(revenue),
      aov: paidCount ? round2(revenue / paidCount) : 0,
      currency,
    }
  } catch (e: any) {
    return { error: e?.message || "could not read sales" }
  }
}

/* ------------------------------- low stock ------------------------------- */

/**
 * The actual products/variants at or below `threshold` available. Reuses the
 * needs-attention low-stock scan (real, non-sample products → managed variants →
 * real inventory levels) but returns the itemised list rather than just a count.
 */
export async function lowStockList(req: MedusaRequest, ctx: Ctx, threshold = 3) {
  const limit = Math.max(0, Math.floor(Number(threshold)))
  try {
    const scId = ctx.tenant.meta?.sales_channel_id
    if (!scId) return { threshold: limit, count: 0, items: [] }
    const query = q(req)

    const { data: links } = await query.graph({
      entity: "product_sales_channel",
      filters: { sales_channel_id: scId } as any,
      fields: ["product_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    const pids = (links || []).map((l: any) => l.product_id).filter(Boolean)
    if (!pids.length) return { threshold: limit, count: 0, items: [] }

    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: pids } as any,
      fields: [
        "id",
        "title",
        "metadata",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.manage_inventory",
      ],
      pagination: { take: 2000, skip: 0 } as any,
    })

    // Managed variants of real products, capped to keep the scan cheap.
    const VARIANT_SCAN_CAP = 80
    const variantIds: string[] = []
    const variantMeta = new Map<string, { product: string; variant: string }>()
    for (const p of products || []) {
      if ((p as any).metadata?.is_sample) continue
      for (const v of (p as any).variants || []) {
        if (!v?.id) continue
        if (v.manage_inventory === false) continue
        variantIds.push(v.id)
        variantMeta.set(v.id, {
          product: (p as any).title ?? "Product",
          variant: v.title ?? v.sku ?? "Default",
        })
        if (variantIds.length >= VARIANT_SCAN_CAP) break
      }
      if (variantIds.length >= VARIANT_SCAN_CAP) break
    }
    if (!variantIds.length) return { threshold: limit, count: 0, items: [] }

    const available = await getAvailableByVariant(req, variantIds)
    const items: { product: string; variant: string; available: number }[] = []
    for (const vId of Object.keys(available)) {
      const avail = available[vId]
      if (avail <= limit) {
        const meta = variantMeta.get(vId)
        items.push({
          product: meta?.product ?? "Product",
          variant: meta?.variant ?? "Default",
          available: avail,
        })
      }
    }
    items.sort((a, b) => a.available - b.available)
    return { threshold: limit, count: items.length, items: items.slice(0, 20) }
  } catch (e: any) {
    return { error: e?.message || "could not read stock" }
  }
}

/* ----------------------------- find customer ----------------------------- */

/**
 * Look up a customer within THIS tenant by name or email. There is no direct
 * customer→sales_channel link, so we scan the tenant's recent orders (bounded)
 * and match the customer's name or email against the query, then aggregate that
 * customer's orders into a summary.
 */
export async function findCustomer(req: MedusaRequest, ctx: Ctx, queryStr: string) {
  const needle = String(queryStr || "").toLowerCase().trim()
  if (!needle) return { error: "give a customer name or email to search for" }
  try {
    const scId = ctx.tenant.meta?.sales_channel_id
    if (!scId) return { error: `no customer matching ${queryStr}` }
    const query = q(req)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "metadata",
        "email",
        "currency_code",
        "created_at",
        "customer.id",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
      ],
      filters: { sales_channel_id: scId } as any,
      pagination: { take: 400, skip: 0, order: { created_at: "DESC" } } as any,
    })

    const nameOf = (o: any) =>
      [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ")
    const emailOf = (o: any) => o.customer?.email ?? o.email ?? ""

    const matches = (data || []).filter((o: any) => {
      const hay = `${nameOf(o)} ${emailOf(o)}`.toLowerCase()
      return hay.includes(needle)
    })
    if (!matches.length) return { error: `no customer matching ${queryStr}` }

    // Group the matched orders by customer (id, else email) and pick the group
    // with the most orders — the best-matching customer.
    const groups = new Map<string, any[]>()
    for (const o of matches) {
      const key = o.customer?.id || emailOf(o) || o.id
      const arr = groups.get(key) ?? []
      arr.push(o)
      groups.set(key, arr)
    }
    let best: any[] = []
    for (const arr of groups.values()) {
      if (arr.length > best.length) best = arr
    }

    const money = await orderMoneyFor(
      pg(req),
      best.map((o: any) => o.id)
    )
    let totalSpent = 0
    for (const o of best) totalSpent += money.get(o.id)?.total ?? 0

    const top = best[0]
    const recent = best.slice(0, 5).map((o: any) => ({
      order_no: o.metadata?.store_order_no ?? o.display_id,
      total: round2(money.get(o.id)?.total ?? 0),
      placed_at: o.created_at,
    }))

    return {
      name: nameOf(top) || null,
      email: emailOf(top) || null,
      orders: best.length,
      total_spent: round2(totalSpent),
      currency: (top.currency_code ?? ctx.tenant.meta?.currency_code ?? "usd").toUpperCase(),
      recent,
    }
  } catch (e: any) {
    return { error: e?.message || "could not look up customer" }
  }
}

/* ------------------------------ inbox status ----------------------------- */

/**
 * Unread / open conversation count from the marketing inbox. The marketing
 * module is optional — if it isn't installed, return `{ available: false }`
 * rather than failing. Best-effort throughout.
 */
export async function inboxStatus(req: MedusaRequest, ctx: Ctx) {
  let svc: MarketingModuleService | undefined
  try {
    svc = req.scope.resolve(MARKETING_MODULE) as MarketingModuleService
  } catch {
    return { available: false }
  }
  if (!svc || typeof (svc as any).listAndCountMarketingConversations !== "function") {
    return { available: false }
  }
  try {
    const tenantId = ctx.tenant.id
    const [, open] = await (svc as any).listAndCountMarketingConversations(
      { tenant_id: tenantId, status: "open" },
      { take: 1 }
    )
    const [, unread] = await (svc as any).listAndCountMarketingConversations(
      { tenant_id: tenantId, unread_count: { $gt: 0 } },
      { take: 1 }
    )
    return { available: true, open: open ?? 0, unread: unread ?? 0 }
  } catch (e: any) {
    return { available: true, open: 0, unread: 0, error: e?.message || "inbox read failed" }
  }
}

/* ------------------------------- registry -------------------------------- */

export const MORE_TOOL_DEFS: AiToolDefinition[] = [
  {
    name: "sales_summary",
    description:
      "Revenue and order totals over the last N days (default 30): number of orders, total captured revenue, average order value and currency. Use for 'how much did I make', 'sales this month', 'revenue last week', 'what's my average order'.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days back to summarise (1-365, default 30)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "low_stock",
    description:
      "List the specific products and variants that are low on stock (available at or below a threshold, default 3), with how many are left. Use for 'what's low on stock', 'which products should I restock', 'am I running out of anything'.",
    parameters: {
      type: "object",
      properties: {
        threshold: {
          type: "number",
          description: "Flag variants with available stock at or below this number (default 3)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_customer",
    description:
      "Look up a customer of THIS store by name or email and summarise their orders: total orders, total spent and their most recent orders. Use for 'who is <name>', 'how much has <email> spent', 'find customer <name>'.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Customer name or email to search for" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "inbox_status",
    description:
      "How many customer conversations in the inbox are open and how many have unread messages. Use for 'any new messages', 'how's my inbox', 'unread messages'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const MORE_TOOL_LABELS: Record<string, string> = {
  sales_summary: "Adding up your recent sales",
  low_stock: "Checking what's low on stock",
  find_customer: "Looking up that customer",
  inbox_status: "Checking your inbox",
}

/** Dispatch one P2 tool call → its JSON-serialisable result. Never throws. */
export async function runMoreTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  const a = args ?? {}
  try {
    switch (name) {
      case "sales_summary":
        return await salesSummary(req, ctx, Number(a.days) || 30)
      case "low_stock":
        return await lowStockList(req, ctx, a.threshold == null ? 3 : Number(a.threshold))
      case "find_customer":
        return await findCustomer(req, ctx, String(a.query ?? ""))
      case "inbox_status":
        return await inboxStatus(req, ctx)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
