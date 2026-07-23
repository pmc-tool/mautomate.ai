import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import {
  capturePaymentWorkflow,
  markPaymentCollectionAsPaid,
  refundPaymentWorkflow,
  cancelOrderWorkflow,
} from "@medusajs/core-flows"
import { fulfillmentStatusFrom, orderMoneyFor } from "../orders/_status"

/**
 * Pixi P1 — HARD (money-moving / irreversible) write tools.
 *
 * These four tools move money or destroy state: capturing an authorization,
 * marking a collection paid, refunding a customer, cancelling an order. Every
 * one is `tier:"hard"` and carries a `requireText` word the merchant must type
 * to confirm — the runtime gates on that, not this file.
 *
 * CONTRACT (mirrors _writes-soft.ts so a sibling can concat both):
 *   - The MODEL only ever supplies a customer-facing `order_no` (and, for two
 *     tools, an optional amount / note). It NEVER supplies internal ids, payment
 *     ids, collection ids, or the tenant — those are resolved server-side here.
 *   - `plan()` MUST NOT mutate. It resolves the order tenant-scoped (by
 *     store_order_no, then display_id — exactly like the P0 getOrder), reads the
 *     real money via `orderMoneyFor`, VALIDATES the order state, resolves the
 *     payment/collection id, and returns a precise `human_summary` with the exact
 *     amount + currency. On any invalid state it returns `{ ok:false, error }`
 *     in plain language — it never throws.
 *   - `apply()` runs the underlying core-flow workflow directly with the ids the
 *     plan resolved, and returns `{ result, undo }`.
 *
 * Amounts are in MAJOR units (this platform stores/handles whole-unit money — no
 * cents math), read from `orderMoneyFor` and the payment rows the routes use.
 */

export type Ctx = { tenant: any; merchant: any; svc: any }
export type PlanResult =
  | { ok: true; human_summary: string; details: Record<string, unknown>; apply_args: Record<string, any> }
  | { ok: false; error: string }
export type ApplyResult = { result: any; undo?: { action: string; apply_args: Record<string, any> } | { available: false; reason: string } }
export type JarvisWrite = {
  name: string; description: string; parameters: Record<string, unknown>
  risk: "low" | "med" | "high"; tier: "soft" | "hard"; requireText?: string
  plan(req: MedusaRequest, ctx: Ctx, args: Record<string, any>): Promise<PlanResult>
  apply(req: MedusaRequest, ctx: Ctx, applyArgs: Record<string, any>): Promise<ApplyResult>
}

/* --------------------------------- helpers -------------------------------- */

const num = (v: any) => Number(v ?? 0)

/** Amount already captured on a payment: captures win, else fall back to the
 *  captured_at flag standing in for the whole payment. Mirrors the routes. */
const capturedOf = (p: any) =>
  (p.captures || []).reduce((s: number, c: any) => s + num(c.amount), 0) ||
  (p.captured_at ? num(p.amount) : 0)

/** Whole-unit money label. This platform uses major units, so no /100. */
const fmt = (amount: number, currency: string) =>
  `${amount} ${(currency || "").toUpperCase()}`

const RESOLVE_FIELDS = [
  "id",
  "display_id",
  "metadata",
  "status",
  "email",
  "currency_code",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.payments.id",
  "payment_collections.payments.amount",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.captures.id",
  "payment_collections.payments.captures.amount",
  "payment_collections.payments.refunds.amount",
  "fulfillments.canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
]

type Resolved = {
  order: any
  money: {
    total: number | null
    paid_total: number | null
    pending_difference: number | null
    quantities: Map<string, number>
  } | null
  order_no: string
}

/**
 * Resolve ONE order tenant-scoped by its customer-facing number — identical to
 * the P0 getOrder: bounded scan of this store's orders, match on
 * metadata.store_order_no first, then the global display_id. Returns the raw
 * graph row (with payment + fulfillment fields) plus its authoritative money.
 * Never throws; returns `{ error }` in plain language on any miss.
 */
async function resolveOrder(
  req: MedusaRequest,
  ctx: Ctx,
  orderNo: string | number
): Promise<Resolved | { error: string }> {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { error: "your store isn't fully set up yet, so I can't look up orders." }
  const target = String(orderNo ?? "").replace(/[^0-9]/g, "")
  if (!target) return { error: "tell me which order — give me the order number, e.g. 1043." }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: RESOLVE_FIELDS,
    filters: { sales_channel_id: scId } as any,
    pagination: { take: 400, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const match =
    (data || []).find((o: any) => String(o.metadata?.store_order_no ?? "") === target) ??
    (data || []).find((o: any) => String(o.display_id ?? "") === target)
  if (!match) return { error: `I couldn't find order #${target} in this store.` }

  const money = await orderMoneyFor(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    [match.id]
  )
  return { order: match, money: money.get(match.id) ?? null, order_no: target }
}

const customerOf = (o: any) =>
  [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
  o.email ||
  "the customer"

/**
 * Hard tenant backstop for apply(): re-resolve the frozen order_id scoped to the
 * caller's sales channel and THROW if it doesn't belong to this store. This makes
 * isolation independent of the confirm token — even a leaked or forged token
 * cannot move money on another tenant's order, because apply() re-checks
 * ownership against the live request context before touching any workflow.
 */
async function assertOwnership(req: MedusaRequest, ctx: Ctx, orderId: string) {
  const scId = ctx.tenant.meta?.sales_channel_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: { id: orderId, sales_channel_id: scId } as any,
    pagination: { take: 1, skip: 0 } as any,
  })
  if (!(data || []).length) {
    throw new Error("This order does not belong to your store.")
  }
}

/* ============================ 1. mark_order_paid =========================== */

const markOrderPaid: JarvisWrite = {
  name: "mark_order_paid",
  description:
    "Collect the outstanding balance on an order so it becomes paid — captures an authorized card/manual payment, or marks a manual/offline collection paid. Use for 'mark order 1043 as paid', 'collect payment on that order'. This MOVES MONEY and cannot be silently undone (a reversal is a separate refund).",
  parameters: {
    type: "object",
    properties: {
      order_no: { type: "string", description: "The order number, e.g. '1043'" },
    },
    required: ["order_no"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "PAID",

  async plan(req, ctx, args) {
    const r = await resolveOrder(req, ctx, args.order_no)
    if ("error" in r) return { ok: false, error: r.error }
    const { order, money, order_no } = r

    if (order.status === "canceled") {
      return { ok: false, error: `order #${order_no} is cancelled — there's nothing to collect on it.` }
    }

    const cur = order.currency_code
    const collections = order.payment_collections || []
    const payments = collections.flatMap((pc: any) => pc.payments || [])

    // Authoritative total from order_summary; paid derived from captures (route logic).
    const total = num(money?.total)
    const paidTotal = payments.reduce((s: number, p: any) => s + capturedOf(p), 0)
    const outstanding = total - paidTotal
    if (outstanding <= 0.001) {
      return { ok: false, error: `order #${order_no} is already fully paid.` }
    }

    // Path 1: capture authorized, uncaptured, non-canceled payments up to the
    // outstanding amount (mirrors the mark-paid route exactly, incl. rounding).
    const authorized = payments.filter(
      (p: any) => !p.canceled_at && capturedOf(p) < num(p.amount)
    )
    if (authorized.length) {
      let remaining = Math.round(outstanding)
      const captures: { payment_id: string; amount?: number }[] = []
      for (const p of authorized) {
        if (remaining <= 0) break
        const capturable = Math.round(num(p.amount) - capturedOf(p))
        const partial = remaining < capturable ? remaining : undefined
        captures.push({ payment_id: p.id, ...(partial != null ? { amount: partial } : {}) })
        remaining -= partial ?? capturable
      }
      return {
        ok: true,
        human_summary: `Mark order #${order_no} as paid by capturing the outstanding ${fmt(outstanding, cur)} for ${customerOf(order)}.`,
        details: { order_no, mode: "capture", outstanding, currency: (cur || "").toUpperCase(), captures: captures.length },
        apply_args: { mode: "capture", captures, order_id: order.id },
      }
    }

    // Path 2: no authorized payment — mark a manual not_paid/awaiting collection paid.
    const collection = collections.find(
      (pc: any) => pc.status === "not_paid" || pc.status === "awaiting"
    )
    if (!collection) {
      return { ok: false, error: `order #${order_no} has no outstanding payment to collect.` }
    }
    return {
      ok: true,
      human_summary: `Mark order #${order_no} as paid — record the outstanding ${fmt(outstanding, cur)} as collected for ${customerOf(order)}.`,
      details: { order_no, mode: "mark_paid", outstanding, currency: (cur || "").toUpperCase() },
      apply_args: { mode: "mark_paid", payment_collection_id: collection.id, order_id: order.id },
    }
  },

  async apply(req, ctx, applyArgs) {
    await assertOwnership(req, ctx, applyArgs.order_id)
    if (applyArgs.mode === "capture") {
      const payments: any[] = []
      for (const c of applyArgs.captures || []) {
        const { result } = await capturePaymentWorkflow(req.scope).run({
          input: { payment_id: c.payment_id, ...(c.amount != null ? { amount: c.amount } : {}) },
        })
        payments.push(result)
      }
      return {
        result: { action: "captured", payments },
        undo: { available: false, reason: "reversing a payment is a separate refund" },
      }
    }
    const { result } = await markPaymentCollectionAsPaid(req.scope).run({
      input: {
        payment_collection_id: applyArgs.payment_collection_id,
        order_id: applyArgs.order_id,
        captured_by: ctx.merchant?.id,
      },
    })
    return {
      result: { action: "marked_paid", collection: result },
      undo: { available: false, reason: "reversing a payment is a separate refund" },
    }
  },
}

/* ============================= 2. capture_payment ========================== */

const capturePayment: JarvisWrite = {
  name: "capture_payment",
  description:
    "Capture an authorized (uncaptured) payment on an order, collecting the money — optionally a partial amount. Use for 'capture the payment on order 1043', 'capture $50 of that authorization'. This MOVES MONEY and cannot be undone (a capture is reversed only via a separate refund).",
  parameters: {
    type: "object",
    properties: {
      order_no: { type: "string", description: "The order number, e.g. '1043'" },
      amount: {
        type: "number",
        description: "Optional whole-unit amount to capture (default: the full authorized amount)",
      },
    },
    required: ["order_no"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "CAPTURE",

  async plan(req, ctx, args) {
    const r = await resolveOrder(req, ctx, args.order_no)
    if ("error" in r) return { ok: false, error: r.error }
    const { order, order_no } = r

    if (order.status === "canceled") {
      return { ok: false, error: `order #${order_no} is cancelled — you can't capture payment on it.` }
    }

    const cur = order.currency_code
    const payments = (order.payment_collections || []).flatMap((pc: any) => pc.payments || [])
    // First authorized, non-canceled, not-fully-captured payment (route logic).
    const payment = payments.find(
      (p: any) => !p.canceled_at && capturedOf(p) < num(p.amount)
    )
    if (!payment) {
      return { ok: false, error: `order #${order_no} has no authorized payment to capture.` }
    }

    const capturable = num(payment.amount) - capturedOf(payment)
    let amount: number | undefined
    if (args.amount != null) {
      amount = Number(args.amount)
      if (!(amount > 0)) {
        return { ok: false, error: "the capture amount has to be greater than zero." }
      }
      if (amount > capturable) {
        return {
          ok: false,
          error: `you can only capture up to ${fmt(capturable, cur)} on order #${order_no}'s authorization.`,
        }
      }
    }

    const shown = amount ?? capturable
    return {
      ok: true,
      human_summary: `Capture ${fmt(shown, cur)} on order #${order_no} for ${customerOf(order)}.`,
      details: {
        order_no,
        amount: shown,
        currency: (cur || "").toUpperCase(),
        partial: amount != null && amount < capturable,
      },
      apply_args: { order_id: order.id, payment_id: payment.id, ...(amount != null ? { amount } : {}) },
    }
  },

  async apply(req, ctx, applyArgs) {
    await assertOwnership(req, ctx, applyArgs.order_id)
    const { result } = await capturePaymentWorkflow(req.scope).run({
      input: {
        payment_id: applyArgs.payment_id,
        ...(applyArgs.amount != null ? { amount: applyArgs.amount } : {}),
      },
    })
    return {
      result: { payment: result },
      undo: { available: false, reason: "a capture cannot be reversed; issue a refund instead" },
    }
  },
}

/* ============================== 3. refund_order =========================== */

const refundOrder: JarvisWrite = {
  name: "refund_order",
  description:
    "Refund money back to the customer on an order that has a captured payment — the full captured amount, or a partial amount. Use for 'refund order 1043', 'refund $20 to that customer'. This MOVES MONEY and CANNOT be reversed.",
  parameters: {
    type: "object",
    properties: {
      order_no: { type: "string", description: "The order number, e.g. '1043'" },
      amount: {
        type: "number",
        description: "Optional whole-unit amount to refund (default: the full captured amount)",
      },
      note: { type: "string", description: "Optional note recorded on the refund" },
    },
    required: ["order_no"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "REFUND",

  async plan(req, ctx, args) {
    const r = await resolveOrder(req, ctx, args.order_no)
    if ("error" in r) return { ok: false, error: r.error }
    const { order, order_no } = r

    const cur = order.currency_code
    // Only captured payments can be refunded (route logic).
    const payments = (order.payment_collections || [])
      .flatMap((pc: any) => pc.payments || [])
      .filter((p: any) => p.captured_at && (p.captures || []).length > 0)
    if (!payments.length) {
      return { ok: false, error: `order #${order_no} has no captured payment to refund.` }
    }

    const payment = payments[0]
    const capturedTotal = (payment.captures || []).reduce(
      (s: number, c: any) => s + num(c.amount),
      0
    )
    // What's already been refunded reduces what's refundable — otherwise the cap
    // (and the card) would overstate the refundable amount after a partial refund.
    const refundedTotal = (payment.refunds || []).reduce(
      (s: number, rf: any) => s + num(rf.amount),
      0
    )
    const refundable = capturedTotal - refundedTotal
    if (refundable <= 0.001) {
      return { ok: false, error: `order #${order_no} has already been fully refunded.` }
    }

    let amount: number | undefined
    if (args.amount != null) {
      amount = Number(args.amount)
      if (!(amount > 0)) {
        return { ok: false, error: "the refund amount has to be greater than zero." }
      }
      if (amount > refundable) {
        return {
          ok: false,
          error: `you can only refund up to ${fmt(refundable, cur)} on order #${order_no} — that's what's left after any prior refunds.`,
        }
      }
    }

    // FREEZE the exact amount into apply_args ALWAYS — for a full refund we send
    // `refundable`, never relying on the module default (which is the full
    // AUTHORIZED amount and throws on a partially-captured order).
    const shown = amount != null ? amount : refundable
    const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined
    return {
      ok: true,
      human_summary: `Refund ${fmt(shown, cur)} to ${customerOf(order)} on order #${order_no}.`,
      details: {
        order_no,
        amount: shown,
        currency: (cur || "").toUpperCase(),
        partial: shown < capturedTotal,
        note: note ?? null,
      },
      apply_args: { order_id: order.id, payment_id: payment.id, amount: shown, ...(note ? { note } : {}) },
    }
  },

  async apply(req, ctx, applyArgs) {
    await assertOwnership(req, ctx, applyArgs.order_id)
    const { result } = await refundPaymentWorkflow(req.scope).run({
      input: {
        payment_id: applyArgs.payment_id,
        amount: applyArgs.amount,
        note: applyArgs.note,
      },
    })
    return {
      result: { refund: result },
      undo: { available: false, reason: "refunds cannot be reversed" },
    }
  },
}

/* ============================== 4. cancel_order ========================== */

const cancelOrder: JarvisWrite = {
  name: "cancel_order",
  description:
    "Cancel an order that has not shipped yet. Use for 'cancel order 1043'. This is IRREVERSIBLE — a cancelled order cannot be un-cancelled — and an already shipped, delivered, completed or cancelled order cannot be cancelled.",
  parameters: {
    type: "object",
    properties: {
      order_no: { type: "string", description: "The order number, e.g. '1043'" },
    },
    required: ["order_no"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "CANCEL",

  async plan(req, ctx, args) {
    const r = await resolveOrder(req, ctx, args.order_no)
    if ("error" in r) return { ok: false, error: r.error }
    const { order, money, order_no } = r

    if (order.status === "canceled") {
      return { ok: false, error: `order #${order_no} is already cancelled.` }
    }
    if (order.status === "completed") {
      return { ok: false, error: `order #${order_no} is completed and can't be cancelled.` }
    }
    const fs = fulfillmentStatusFrom(order.fulfillments)
    if (fs === "shipped" || fs === "delivered") {
      return {
        ok: false,
        error: `order #${order_no} has already ${fs === "delivered" ? "been delivered" : "shipped"} — it can't be cancelled.`,
      }
    }

    const cur = order.currency_code
    const total = num(money?.total)
    return {
      ok: true,
      human_summary: `Cancel order #${order_no} (${fmt(total, cur)}) for ${customerOf(order)}.`,
      details: { order_no, total, currency: (cur || "").toUpperCase(), customer: customerOf(order) },
      apply_args: { order_id: order.id },
    }
  },

  async apply(req, ctx, applyArgs) {
    await assertOwnership(req, ctx, applyArgs.order_id)
    const { result } = await cancelOrderWorkflow(req.scope).run({
      input: { order_id: applyArgs.order_id },
    })
    return {
      result: result ?? { success: true },
      undo: { available: false, reason: "a cancelled order cannot be un-cancelled" },
    }
  },
}

/* ------------------------------- registry -------------------------------- */

export const MONEY_WRITES: JarvisWrite[] = [
  markOrderPaid,
  capturePayment,
  refundOrder,
  cancelOrder,
]
