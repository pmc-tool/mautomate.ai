import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { MARKETING_MODULE } from "../../../modules/marketing"
import {
  paymentStatusFrom,
  fulfillmentStatusFrom,
  orderMoneyFor,
} from "../orders/_status"

/**
 * Pixi OPS — four more READ-ONLY tools covering DELIVERY (the ship queue and
 * problem deliveries) and the INBOX/EMAIL side (messages that need a human, and
 * today's email activity).
 *
 * Same contract as `_tools.ts` / `_tools-more.ts`: every handler is tenant-scoped
 * through `ctx` (the tenant is NEVER read from the model's arguments) and NEVER
 * throws — a failure returns `{ error }` (or `{ available: false }` when an
 * optional module is missing) the model can read and explain, so a broken tool
 * degrades the answer instead of breaking the run. Order totals come from
 * `orderMoneyFor`, which reads the authoritative order_summary/order_item tables.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

const pg = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

const DAY_MS = 24 * 60 * 60 * 1000

// Payment states that mean the order's money has actually been collected.
const PAID_STATUSES = new Set(["captured", "partially_captured"])
// Fulfillment states that mean the parcel is on its way or already done — i.e.
// NOT sitting in the ship queue.
const DONE_FULFILLMENT = new Set(["shipped", "delivered", "canceled"])

// Bounded scan of the tenant's recent orders — enough to cover the ship queue
// and problem deliveries without an unbounded read. Newest-first.
const ORDER_SCAN = 400

const OPS_ORDER_FIELDS = [
  "id",
  "display_id",
  "metadata",
  "status",
  "email",
  "currency_code",
  "created_at",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.country_code",
  "payment_collections.status",
  "fulfillments.canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
]

const orderNoOf = (o: any) => o.metadata?.store_order_no ?? o.display_id

const customerOf = (o: any) =>
  [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
  o.email ||
  null

const daysWaiting = (o: any) => {
  const t = o.created_at ? new Date(o.created_at).getTime() : NaN
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS))
}

/**
 * One bounded, tenant-scoped read of the store's recent orders with the money
 * map attached. Shared by ordersToDeliver + deliveryIssues so each tool is a
 * single query + one order_summary read. Returns `null` on any failure so the
 * caller can degrade gracefully.
 */
async function scanOrders(
  req: MedusaRequest,
  ctx: Ctx
): Promise<{ orders: any[]; money: Map<string, any> } | null> {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { orders: [], money: new Map() }
  try {
    const { data } = await q(req).graph({
      entity: "order",
      fields: OPS_ORDER_FIELDS,
      filters: { sales_channel_id: scId } as any,
      pagination: {
        take: ORDER_SCAN,
        skip: 0,
        order: { created_at: "DESC" },
      } as any,
    })
    const orders = (data || []).filter((o: any) => o.status !== "canceled")
    const money = await orderMoneyFor(
      pg(req),
      orders.map((o: any) => o.id)
    )
    return { orders, money }
  } catch {
    return null
  }
}

/* ---------------------------- orders to deliver --------------------------- */

/**
 * The ship queue: orders whose money is in the bank (payment captured, fully or
 * partially) but that have NOT yet shipped, been delivered, or been canceled.
 * These are the sales the merchant still has to send out. Newest first, cap 25.
 */
export async function ordersToDeliver(req: MedusaRequest, ctx: Ctx) {
  try {
    const scan = await scanOrders(req, ctx)
    if (!scan) return { error: "could not read your orders" }
    const rows: any[] = []
    for (const o of scan.orders) {
      const payment = paymentStatusFrom(o.payment_collections)
      if (!PAID_STATUSES.has(payment)) continue
      const fulfillment = fulfillmentStatusFrom(o.fulfillments)
      if (DONE_FULFILLMENT.has(fulfillment)) continue
      rows.push({
        order_no: orderNoOf(o),
        customer: customerOf(o),
        total: round2(scan.money.get(o.id)?.total ?? 0),
        currency: (o.currency_code ?? "").toUpperCase(),
        placed_at: o.created_at,
        fulfillment_state: fulfillment,
      })
    }
    return { count: rows.length, orders: rows.slice(0, 25) }
  } catch (e: any) {
    return { error: e?.message || "could not read the ship queue" }
  }
}

/* ----------------------------- delivery issues ---------------------------- */

/**
 * Problem deliveries. Two conservative buckets:
 *   - canceled_fulfillments: an order that has a CANCELED fulfillment (a shipment
 *     that was created then voided — worth a look).
 *   - stuck: paid but still unfulfilled and placed more than 5 days ago — money
 *     taken, nothing shipped, and it has been sitting a while.
 * Never invents a "failed" state the data can't back up.
 */
export async function deliveryIssues(req: MedusaRequest, ctx: Ctx) {
  try {
    const scan = await scanOrders(req, ctx)
    if (!scan) return { error: "could not read your orders" }
    const stuck: any[] = []
    const canceled_fulfillments: any[] = []
    for (const o of scan.orders) {
      const fulfillment = fulfillmentStatusFrom(o.fulfillments)
      const payment = paymentStatusFrom(o.payment_collections)
      const hasCanceledFulfillment = (o.fulfillments || []).some(
        (f: any) => f?.canceled_at
      )
      if (hasCanceledFulfillment) {
        canceled_fulfillments.push({
          order_no: orderNoOf(o),
          customer: customerOf(o),
          total: round2(scan.money.get(o.id)?.total ?? 0),
          currency: (o.currency_code ?? "").toUpperCase(),
          placed_at: o.created_at,
          fulfillment_state: fulfillment,
        })
      }
      // Stuck = paid, still not fulfilled at all, and waiting > 5 days.
      if (
        PAID_STATUSES.has(payment) &&
        fulfillment === "not_fulfilled" &&
        daysWaiting(o) > 5
      ) {
        stuck.push({
          order_no: orderNoOf(o),
          customer: customerOf(o),
          days_waiting: daysWaiting(o),
          total: round2(scan.money.get(o.id)?.total ?? 0),
          currency: (o.currency_code ?? "").toUpperCase(),
          placed_at: o.created_at,
        })
      }
    }
    stuck.sort((a, b) => b.days_waiting - a.days_waiting)
    return {
      count: stuck.length + canceled_fulfillments.length,
      stuck: stuck.slice(0, 25),
      canceled_fulfillments: canceled_fulfillments.slice(0, 25),
    }
  } catch (e: any) {
    return { error: e?.message || "could not check for delivery issues" }
  }
}

/* ------------------------------- needs human ------------------------------ */

/**
 * Customer messages waiting on a HUMAN across every inbox channel (WhatsApp,
 * website widget, Instagram, Messenger, voice, …).
 *
 * The real signal is `handler_mode = 'queued'` on the conversation: the bot has
 * escalated (handoff requested) and is waiting for a person to pick the thread
 * up. This is exactly the inbox's own "Needs you" view. Closed threads excluded.
 * The marketing module is optional — if it isn't installed, `{ available: false }`.
 */
export async function needsHuman(req: MedusaRequest, ctx: Ctx) {
  let mk: any
  try {
    mk = req.scope.resolve(MARKETING_MODULE)
  } catch {
    return { available: false }
  }
  if (!mk || typeof mk.listAndCountMarketingConversations !== "function") {
    return { available: false }
  }
  try {
    const tenantId = ctx.tenant.id
    const filter = {
      tenant_id: tenantId,
      handler_mode: "queued",
      status: { $ne: "closed" },
    }
    const [rows, total] = await mk.listAndCountMarketingConversations(filter, {
      order: { last_message_at: "DESC" },
      take: 15,
    })
    const page: any[] = Array.isArray(rows) ? rows : []

    // Batched contact lookup (for a human-readable "from").
    const contactIds = Array.from(
      new Set(page.map((r) => r.contact_id).filter(Boolean))
    ) as string[]
    const contactMap = new Map<string, any>()
    if (contactIds.length) {
      try {
        const contacts = await mk.listMarketingContacts({
          tenant_id: tenantId,
          id: contactIds,
        })
        for (const c of Array.isArray(contacts) ? contacts : []) {
          contactMap.set(c.id, c)
        }
      } catch {
        // A name is a nicety; losing it must not lose the thread.
      }
    }

    // Batched last-message preview — one DISTINCT ON scan for the whole page.
    const previews = new Map<string, string | null>()
    if (page.length) {
      try {
        const result = await pg(req)
          .select("conversation_id", "body")
          .from("marketing_message")
          .distinctOn("conversation_id")
          .whereIn(
            "conversation_id",
            page.map((r) => r.id)
          )
          .whereNull("deleted_at")
          .orderBy([
            { column: "conversation_id" },
            { column: "sent_at", order: "desc" },
          ])
        for (const row of Array.isArray(result) ? result : []) {
          previews.set(String(row.conversation_id), row.body ?? null)
        }
      } catch {
        // Preview is best-effort.
      }
    }

    const threads = page.map((r) => {
      const c = r.contact_id ? contactMap.get(r.contact_id) : null
      return {
        channel: r.channel,
        from: c?.display_name || c?.phone || c?.email || "Unknown",
        last_message: previews.get(r.id) ?? null,
        waiting_since: r.last_message_at ?? null,
        // The reason the bot escalated, when it recorded one; otherwise the
        // handler state itself ("queued").
        status: r.handoff_reason || r.handler_mode || "queued",
      }
    })

    return { available: true, count: total ?? threads.length, threads }
  } catch (e: any) {
    return { available: true, count: 0, threads: [], error: e?.message || "inbox read failed" }
  }
}

/* ------------------------------- todays email ----------------------------- */

/**
 * Today's outbound email activity for THIS store, read from the real per-send
 * log (marketing_email_send): how many went out since midnight, and how they're
 * doing (delivered / opened / clicked / failed), plus the most recent few.
 *
 * The marketing module is optional — if it isn't installed, `{ available: false }`.
 * "Today" is since local midnight on the server.
 */
export async function todaysEmail(req: MedusaRequest, ctx: Ctx) {
  try {
    req.scope.resolve(MARKETING_MODULE)
  } catch {
    return { available: false }
  }
  const tenantId = ctx.tenant.id
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const sinceIso = start.toISOString()
  const rowsOf = (result: any): any[] =>
    Array.isArray(result) ? result : (result?.rows ?? [])

  try {
    const summaryResult = await pg(req).raw(
      `select
         count(*)                                                                  as total,
         count(*) filter (where status in ('sent','delivered','opened','clicked')) as sent,
         count(*) filter (where status = 'delivered' or delivered_at is not null)  as delivered,
         count(*) filter (where opened_at is not null)                             as opened,
         count(*) filter (where clicked_at is not null)                            as clicked,
         count(*) filter (where status in ('bounced','complained','failed'))       as failed
       from marketing_email_send
      where tenant_id = ? and deleted_at is null and sent_at >= ?`,
      [tenantId, sinceIso]
    )
    const s = rowsOf(summaryResult)[0] ?? {}
    const n = (v: any): number => Number(v) || 0

    let recent: any[] = []
    try {
      const recentResult = await pg(req)
        .select("subject", "to_email", "status", "sent_at")
        .from("marketing_email_send")
        .where("tenant_id", tenantId)
        .whereNull("deleted_at")
        .where("sent_at", ">=", sinceIso)
        .orderBy("sent_at", "desc")
        .limit(10)
      recent = rowsOf(recentResult).map((r: any) => ({
        subject: r.subject ?? null,
        to: r.to_email ?? null,
        status: r.status ?? null,
        sent_at: r.sent_at ?? null,
      }))
    } catch {
      // Recent list is a nicety.
    }

    return {
      available: true,
      date: start.toISOString().slice(0, 10),
      note: "Emails sent by this store since midnight (server time), from the marketing email send log.",
      sent: n(s.sent),
      delivered: n(s.delivered),
      opened: n(s.opened),
      clicked: n(s.clicked),
      failed: n(s.failed),
      total: n(s.total),
      recent,
    }
  } catch (e: any) {
    return { available: true, error: e?.message || "could not read today's email" }
  }
}

/* -------------------------------- registry -------------------------------- */

export const OPS_TOOL_DEFS: AiToolDefinition[] = [
  {
    name: "orders_to_deliver",
    description:
      "The ship queue: orders that are PAID but not yet shipped or delivered — the sales the merchant still needs to send out, newest first. Use for 'any sales to deliver', 'what do I ship', 'orders to send out', 'what needs shipping', 'anything to fulfil'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "delivery_issues",
    description:
      "Problem deliveries: orders with a canceled shipment, plus paid orders that are still unfulfilled and have been waiting more than 5 days (stuck). Use for 'anything not delivered', 'failed deliveries', 'stuck orders', 'any delivery problems', 'orders taking too long'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "needs_human",
    description:
      "Customer messages waiting on a human across every channel (WhatsApp, website chat, Instagram, Messenger, voice): conversations the bot has handed off and that need a person to reply. Use for 'any message that needs a human', \"who's waiting\", 'what are customers asking', 'any whatsapp/website messages', 'anyone need me to reply'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "todays_email",
    description:
      "Today's outbound email activity for the store: how many emails went out since midnight and how they're doing (delivered, opened, clicked, failed). Use for 'any email today', 'emails today', 'how many emails did I send', 'did my emails go out'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const OPS_TOOL_LABELS: Record<string, string> = {
  orders_to_deliver: "Checking what you need to ship",
  delivery_issues: "Looking for delivery problems",
  needs_human: "Checking who's waiting for a reply",
  todays_email: "Checking today's email",
}

/** Dispatch one OPS tool call → its JSON-serialisable result. Never throws. */
export async function runOpsTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  try {
    switch (name) {
      case "orders_to_deliver":
        return await ordersToDeliver(req, ctx)
      case "delivery_issues":
        return await deliveryIssues(req, ctx)
      case "needs_human":
        return await needsHuman(req, ctx)
      case "todays_email":
        return await todaysEmail(req, ctx)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
