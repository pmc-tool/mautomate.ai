import { MedusaContainer } from "@medusajs/framework/types"

import { CommerceGateway } from "../gateway"
import { retrieveKnowledge } from "../knowledge/rag"

/**
 * AI call-center TOOL REGISTRY.
 *
 * This is the single, typed catalog of actions the voice runtime is allowed to
 * take on an order during a call. The telephony `/telephony/tool-execute` route
 * looks a tool up here by name and runs its `handler`; nothing else in the
 * system decides what the AI may do. Adding a capability = adding one entry.
 *
 * Every tool is one of:
 *   - a READ (risk "none"): fetches normalized data, always runs.
 *   - a WRITE (risk low/med/high): mutates commerce/call state. Writes go
 *     through the `commit()` helper, which honors SHADOW MODE — when
 *     `CALL_CENTER_SHADOW_MODE === "true"` no mutation happens; instead the
 *     tool returns `{ result: { proposed: true, would: <description> } }` so the
 *     LLM can be exercised end-to-end against live data without changing it.
 *
 * AUDIT: every write stamps an entry onto the order's `cc_audit` metadata array
 * (`{ at, source: "ai_call", call_id, action, ... }`) in the SAME write, so the
 * mutation and its provenance are always persisted together.
 *
 * GATEWAY NOTE: the commerce gateway methods all take `tenantId` first, and it
 * exposes a single `markFulfillmentHold(tenantId, orderId, held)` — there is no
 * distinct `releaseFulfillmentHold`, so "release" is `markFulfillmentHold(..,
 * false)` (see `confirmOrder`).
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Blast-radius of a tool. Reads are "none"; writes carry a graded risk. */
export type ToolRisk = "none" | "low" | "med" | "high"

/**
 * Execution context handed to every tool handler. Assembled once per request by
 * the `/telephony/tool-execute` route.
 */
export type ToolContext = {
  /** The request DI scope (Medusa container). */
  container: MedusaContainer
  /** Tenant the call belongs to (single-tenant run uses the default constant). */
  tenantId: string
  /** Our `call_center_call` id (or the provider_call_id) this action is for. */
  callId: string
  /** Normalized commerce backend (orders/customers). */
  gateway: CommerceGateway
  /** The call-center module service (generated CRUD: updateCalls, etc.). */
  cc: any
}

/**
 * In-band tool result. The route always returns HTTP 200 with this shape, so
 * `error` is a returned value, never a thrown/leaked stack. `action` signals the
 * voice runtime to change call flow (e.g. "transfer", "end_call").
 */
export type ToolResult = {
  result?: unknown
  action?: string
  error?: string
}

export type ToolHandler = (
  ctx: ToolContext,
  args: Record<string, unknown>
) => Promise<ToolResult>

export type Tool = {
  name: string
  risk: ToolRisk
  /** True for tools that mutate state (subject to SHADOW MODE via `commit`). */
  write: boolean
  handler: ToolHandler
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

const shadowMode = (): boolean =>
  process.env.CALL_CENTER_SHADOW_MODE === "true"

/**
 * Run a mutation unless SHADOW MODE is on. In shadow mode the side-effecting
 * `exec` is NOT called; instead we surface the proposed change. This is the one
 * place the shadow guardrail lives, so every write tool is consistently gated.
 */
const commit = async (
  would: string,
  exec: () => Promise<unknown>
): Promise<ToolResult> => {
  if (shadowMode()) {
    return { result: { proposed: true, would } }
  }
  const result = await exec()
  return { result }
}

/** Trimmed non-empty string, or undefined. */
const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v : undefined

/** Locate the Call row by our id first, falling back to provider_call_id. */
const findCall = async (ctx: ToolContext): Promise<any | null> => {
  try {
    const byId = await ctx.cc.retrieveCall(ctx.callId)
    if (byId) {
      return byId
    }
  } catch {
    // retrieveCall throws on not-found — fall through to provider lookup.
  }
  try {
    const rows = await ctx.cc.listCalls(
      { provider_call_id: ctx.callId, tenant_id: ctx.tenantId },
      { take: 1 }
    )
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Resolve the order this action targets: an explicit `args.order_id` wins,
 * otherwise fall back to the order linked to the call.
 */
const resolveOrderId = async (
  ctx: ToolContext,
  args: Record<string, unknown>
): Promise<string | null> => {
  const fromArgs = asString(args.order_id)
  if (fromArgs) {
    return fromArgs
  }
  const call = await findCall(ctx)
  return (call?.order_id as string | undefined) ?? null
}

type OrderWriteOpts = {
  /** Metadata keys to shallow-merge onto the order. */
  patch?: Record<string, unknown>
  /** Tags to ADD (union with existing cc_tags — never a destructive replace). */
  addTags?: string[]
  /** Audit detail merged into the stamped cc_audit entry. */
  audit: Record<string, unknown>
}

/**
 * One read + one write: shallow-merges `patch`, unions `addTags` into the
 * existing `cc_tags`, and appends an audit entry to `cc_audit`, all in a single
 * `updateOrderMetadata` call. Additive by design — it never drops existing tags
 * or overwrites unrelated metadata.
 */
const applyOrderWrite = async (
  ctx: ToolContext,
  orderId: string,
  opts: OrderWriteOpts
): Promise<{ order_id: string; tags: string[] }> => {
  const order = await ctx.gateway.getOrder(ctx.tenantId, orderId)
  if (!order) {
    throw new Error(`order ${orderId} not found`)
  }
  const md = order.metadata ?? {}

  const existingTags = Array.isArray(md.cc_tags)
    ? (md.cc_tags as string[])
    : []
  const tags = opts.addTags
    ? Array.from(new Set([...existingTags, ...opts.addTags]))
    : existingTags

  const auditLog = Array.isArray(md.cc_audit)
    ? (md.cc_audit as unknown[])
    : []
  const entry = {
    at: new Date().toISOString(),
    source: "ai_call",
    call_id: ctx.callId,
    ...opts.audit,
  }

  const patch: Record<string, unknown> = {
    ...(opts.patch ?? {}),
    cc_audit: [...auditLog, entry],
  }
  if (opts.addTags) {
    patch.cc_tags = tags
  }

  await ctx.gateway.updateOrderMetadata(ctx.tenantId, orderId, patch)
  return { order_id: orderId, tags }
}

/**
 * Normalized order projection returned to the voice runtime (WISMO-friendly).
 *
 * The raw `status` / `payment_status` / `fulfillment_status` flags are NOT here,
 * on purpose. They routinely disagree — "pending" + "not_paid" + "shipped" on an
 * order that was paid in full and is already in transit — and an agent handed a
 * contradiction will say it out loud. It did: a customer was told their payment
 * had not been received about a parcel that had already left the warehouse.
 *
 * `progress` is that question already answered, by the gateway, from the order's
 * latest version. Say that instead.
 */
const normalizeOrder = (o: NonNullable<Awaited<ReturnType<CommerceGateway["getOrder"]>>>) => {
  const md = o.metadata ?? {}
  return {
    id: o.id,
    display_id: o.display_id,
    status: o.progress?.headline ?? "Status unavailable",
    status_detail: o.progress?.detail ?? "",
    awaiting_payment: o.progress?.awaiting_payment ?? false,
    tracking: (o.tracking ?? []).filter((t) => t.number),
    // The structured status travels with the projection: the chat runtime renders
    // it as an order card, and a downstream reader must never have to re-derive
    // it from flags this projection deliberately no longer carries.
    progress: o.progress ?? null,
    shipped_at: o.shipped_at ?? null,
    delivered_at: o.delivered_at ?? null,
    total: o.total,
    currency_code: o.currency_code,
    email: o.email,
    phone: o.phone,
    items: o.items,
    shipping_address: o.shipping_address,
    created_at: o.created_at,
    tags: Array.isArray(md.cc_tags) ? md.cc_tags : [],
    note:
      "`status` and `status_detail` are the whole truth about where this order " +
      "stands. Do NOT mention payment unless `awaiting_payment` is true — once a " +
      "parcel has shipped the money is settled, and raising it only alarms the " +
      "caller. If `tracking` is empty there is no tracking number: say so and " +
      "offer to follow up. Never invent one, and never invent a delivery date.",
  }
}

/** Address fields we accept for a proposed shipping-address change. */
const ADDRESS_KEYS = [
  "name",
  "phone",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
] as const

const pickAddress = (
  args: Record<string, unknown>
): Record<string, string | null> => {
  const out: Record<string, string | null> = {}
  for (const key of ADDRESS_KEYS) {
    out[key] = asString(args[key]) ?? null
  }
  return out
}

// -----------------------------------------------------------------------------
// Tools
// -----------------------------------------------------------------------------

/**
 * getOrder (READ) — fetch the normalized order the call is about.
 */
const getOrder: Tool = {
  name: "getOrder",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const order = await ctx.gateway.getOrder(ctx.tenantId, orderId)
    if (!order) {
      return { error: `order ${orderId} was not found` }
    }
    return { result: normalizeOrder(order) }
  },
}

/**
 * getOrderStatus (READ) — a compact status summary for "where is my order"
 * (WISMO) questions.
 */
const getOrderStatus: Tool = {
  name: "getOrderStatus",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const order = await ctx.gateway.getOrder(ctx.tenantId, orderId)
    if (!order) {
      return { error: `order ${orderId} was not found` }
    }
    // The summary is spoken almost verbatim, so it has to be a SENTENCE, not a
    // pair of internal enum values glued together with "and". This used to render
    // as "Order 7 is pending and shipped." — which is not English, not true, and
    // not an answer to "where is my order".
    const tracking = (order.tracking ?? []).filter((t) => t.number)
    const progress = order.progress
    const summary = progress
      ? [
          `Order ${order.display_id ?? order.id}: ${progress.headline}.`,
          progress.detail,
          tracking.length
            ? `Tracking number ${tracking[0].number}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : `I do not have a current status for order ${order.display_id ?? order.id}.`

    return {
      result: {
        order_id: order.id,
        display_id: order.display_id,
        status: progress?.headline ?? "unknown",
        status_detail: progress?.detail ?? "",
        awaiting_payment: progress?.awaiting_payment ?? false,
        tracking,
        summary,
        note:
          "Say the summary in your own words. Do NOT mention payment unless " +
          "`awaiting_payment` is true. Never invent a tracking number or a " +
          "delivery date.",
      },
    }
  },
}

// -----------------------------------------------------------------------------
// Read tools: order / customer / catalog lookups (spoken aloud -> keep COMPACT)
// -----------------------------------------------------------------------------

/** Cap for list results returned to the voice runtime (spoken aloud). */
const READ_LIST_CAP = 5

/**
 * One-line, spoken-friendly summary of an order — used for LIST results
 * (findOrders / listCustomerOrders).
 *
 * The raw `status` / `payment_status` / `fulfillment_status` flags are gone from
 * here for the same reason they are gone from `normalizeOrder`: an agent handed
 * `status: "pending"` will SAY "pending", and "pending" is Medusa's word for
 * "not archived" — not "not shipped", and certainly not "not paid". A caller was
 * told his order was pending while the parcel was already in transit.
 *
 * This projection was the last one still leaking them, and it is the one the
 * voice agent actually reaches for when a caller reads out an order number.
 */
const summarizeOrder = (
  o: NonNullable<Awaited<ReturnType<CommerceGateway["getOrder"]>>>
) => ({
  id: o.id,
  display_id: o.display_id,
  status: o.progress?.headline ?? "Status unavailable",
  status_detail: o.progress?.detail ?? "",
  awaiting_payment: o.progress?.awaiting_payment ?? false,
  tracking: (o.tracking ?? []).filter((t) => t.number),
  total: o.total,
  currency_code: o.currency_code,
  created_at: o.created_at,
  item_count: Array.isArray(o.items)
    ? o.items.reduce((n, it) => n + (Number(it.quantity) || 0), 0)
    : 0,
  // Identity-confirmation aids for a spoken call: the customer's name and a
  // MASKED email the agent can read back ("is your email a-star-star at ...?"),
  // plus the spoken-friendly order code so the agent can tell the caller it.
  customer_name: o.shipping_address?.name ?? null,
  email_hint: maskEmail(o.email),
  order_code: (o.metadata as any)?.support_code ?? null,
})

/** Mask an email for read-back: "ava.demo@example.com" -> "a***@example.com". */
const maskEmail = (e: string | null | undefined): string | null => {
  if (!e || typeof e !== "string" || !e.includes("@")) return null
  const [local, domain] = e.split("@")
  const head = local.slice(0, 1)
  return `${head}***@${domain}`
}

/** Truncate a description to keep spoken output short. */
const shortText = (v: string | null | undefined, max = 200): string | null => {
  if (!v) {
    return null
  }
  const s = String(v).trim()
  return s.length > max ? `${s.slice(0, max)}...` : s
}

/** Compact product projection for the voice runtime. */
const summarizeProduct = (p: {
  id: string
  title: string | null
  handle: string | null
  description: string | null
  status: string | null
  min_price: number | null
  currency_code: string | null
  variants: Array<{ in_stock: boolean; inventory_quantity: number }>
}) => {
  const in_stock = (p.variants ?? []).some((v) => v.in_stock)
  const inventory_quantity = (p.variants ?? []).reduce(
    (n, v) => n + (Number(v.inventory_quantity) || 0),
    0
  )
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    min_price: p.min_price,
    currency_code: p.currency_code,
    in_stock,
    inventory_quantity,
    description: shortText(p.description),
  }
}

/**
 * findOrders (READ) — look up orders by human order number / email / phone,
 * scoped to the tenant's sales channel by the gateway. For "look up order #1005".
 */
const findOrders: Tool = {
  name: "findOrders",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const display_id =
      asString(args.order_number) ??
      asString(args.display_id) ??
      (typeof args.order_number === "number"
        ? String(args.order_number)
        : undefined) ??
      (typeof args.display_id === "number"
        ? String(args.display_id)
        : undefined)
    const email = asString(args.email)
    const phone = asString(args.phone)
    const code = asString(args.order_code) ?? asString(args.code)

    if (!display_id && !code && !email && !phone) {
      return {
        error: "provide an order_number, order code, email, or phone to search",
      }
    }

    const orders = await ctx.gateway.findOrders(ctx.tenantId, {
      display_id,
      code,
      email,
      phone,
    })
    if (!orders.length) {
      return { result: { orders: [], note: "no matching orders" } }
    }

    // Anchor the call to a uniquely-identified order so every later tool
    // (getOrder, getOrderStatus, addOrderNote) operates on it automatically —
    // the model no longer has to thread order_id through each call, and notes
    // actually persist against the right order. Only link on a single match.
    if (orders.length === 1) {
      try {
        const call = await findCall(ctx)
        if (call?.id) {
          await ctx.cc.updateCalls({ id: call.id, order_id: orders[0].id })
        }
      } catch {
        // Non-fatal: linking is a convenience, not required for the read result.
      }
    }

    return {
      result: { orders: orders.slice(0, READ_LIST_CAP).map(summarizeOrder) },
    }
  },
}

/**
 * listCustomerOrders (READ) — list a caller's orders by email or phone, scoped
 * to the tenant's sales channel by the gateway.
 */
const listCustomerOrders: Tool = {
  name: "listCustomerOrders",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const email = asString(args.email)
    const phone = asString(args.phone)
    if (!email && !phone) {
      return { error: "provide an email or phone to look up the caller's orders" }
    }
    const orders = await ctx.gateway.listCustomerOrders(ctx.tenantId, {
      email,
      phone,
    })
    if (!orders.length) {
      return { result: { orders: [], note: "no matching orders" } }
    }
    return {
      result: { orders: orders.slice(0, READ_LIST_CAP).map(summarizeOrder) },
    }
  },
}

/**
 * searchProducts (READ) — free-text catalog search, scoped to the tenant's
 * sales channel by the gateway. For "do you have X".
 */
const searchProducts: Tool = {
  name: "searchProducts",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    // Callers speak like people, not search engines: "what do you sell",
    // "something under 1000", "anything for the kitchen". An empty or vague
    // query must LIST the catalogue, never fail — a shop assistant who answers
    // "I need a keyword" is useless.
    const query = asString(args.query) ?? asString(args.q) ?? ""
    const rawLimit = Number(args.limit)
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, READ_LIST_CAP)
        : READ_LIST_CAP
    const products = await ctx.gateway.searchProducts(
      ctx.tenantId,
      query,
      limit
    )
    if (!products.length) {
      return { result: { products: [], note: "no matching products" } }
    }
    return {
      result: {
        products: products.slice(0, READ_LIST_CAP).map(summarizeProduct),
      },
    }
  },
}

/**
 * getProduct (READ) — fetch one product by id / handle (or best title match),
 * scoped to the tenant's sales channel by the gateway. For price / stock.
 */
const getProduct: Tool = {
  name: "getProduct",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const idOrHandle = asString(args.product_id) ?? asString(args.handle)
    let product = idOrHandle
      ? await ctx.gateway.getProduct(ctx.tenantId, idOrHandle)
      : null

    // Fall back to a title search and take the top in-channel match.
    if (!product) {
      const title = asString(args.title) ?? asString(args.query)
      if (!title && !idOrHandle) {
        return { error: "provide a product_id, handle, or title" }
      }
      if (title) {
        const matches = await ctx.gateway.searchProducts(ctx.tenantId, title, 1)
        product = matches[0] ?? null
      }
    }

    if (!product) {
      return { result: { product: null, note: "no matching product" } }
    }
    return { result: { product: summarizeProduct(product) } }
  },
}

/**
 * confirmOrder (MED) — customer confirms a COD order. Releases the fulfillment
 * hold, stamps the confirmation, and tags it. Requires an explicit yes.
 */
const confirmOrder: Tool = {
  name: "confirmOrder",
  risk: "med",
  write: true,
  handler: async (ctx, args) => {
    if (args.confirmed !== true) {
      return {
        error:
          "confirmation required: caller must explicitly confirm before the order is released",
      }
    }
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const confirmedAt = new Date().toISOString()
    return commit(
      `release fulfillment hold and confirm COD order ${orderId}, tag "cod:confirmed"`,
      async () => {
        // No distinct releaseFulfillmentHold on the gateway — "release" is hold=false.
        await ctx.gateway.markFulfillmentHold(ctx.tenantId, orderId, false)
        const res = await applyOrderWrite(ctx, orderId, {
          patch: {
            cc_cod_confirmation_status: "confirmed",
            cc_confirmed_at: confirmedAt,
          },
          addTags: ["cod:confirmed"],
          audit: { action: "confirmOrder", confirmed_at: confirmedAt },
        })
        return {
          ...res,
          cc_cod_confirmation_status: "confirmed",
          cc_confirmed_at: confirmedAt,
        }
      }
    )
  },
}

/**
 * rescheduleDelivery (MED) — record a customer-requested delivery window and
 * defer the order.
 */
const rescheduleDelivery: Tool = {
  name: "rescheduleDelivery",
  risk: "med",
  write: true,
  handler: async (ctx, args) => {
    const window = asString(args.window)
    if (!window) {
      return { error: "window is required (the requested delivery date/time)" }
    }
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    return commit(
      `set requested delivery to "${window}" on order ${orderId}, tag "cod:deferred"`,
      async () => {
        const res = await applyOrderWrite(ctx, orderId, {
          patch: { cc_requested_delivery_at: window },
          addTags: ["cod:deferred"],
          audit: { action: "rescheduleDelivery", window },
        })
        return { ...res, cc_requested_delivery_at: window }
      }
    )
  },
}

/**
 * updateShippingAddress (MED) — GUARDRAILED. Per the address read-back rule we
 * NEVER silently overwrite the real shipping address. The caller must confirm
 * the address was read back (`confirmed_by_readback === true`); we then store
 * the PROPOSED change under `cc_address_change` and tag it for a human to apply.
 */
const updateShippingAddress: Tool = {
  name: "updateShippingAddress",
  risk: "med",
  write: true,
  handler: async (ctx, args) => {
    if (args.confirmed_by_readback !== true) {
      return {
        error:
          "read back the full new address to the caller and set confirmed_by_readback=true before changing it",
      }
    }
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const proposed = pickAddress(args)
    const at = new Date().toISOString()
    return commit(
      `queue a proposed shipping-address change on order ${orderId} for human review (tag "cc:address-review")`,
      async () => {
        const res = await applyOrderWrite(ctx, orderId, {
          patch: {
            cc_address_change: { proposed, at, call_id: ctx.callId },
          },
          addTags: ["cc:address-review"],
          audit: { action: "updateShippingAddress", proposed },
        })
        return {
          ...res,
          proposed_address: proposed,
          note: "stored as a proposed change for human review; the live address was NOT modified",
        }
      }
    )
  },
}

/**
 * cancelOrder (HIGH) — cancel at the customer's request. Requires an explicit
 * yes; records the reason, cancels via the gateway, and tags it.
 */
const cancelOrder: Tool = {
  name: "cancelOrder",
  risk: "high",
  write: true,
  handler: async (ctx, args) => {
    if (args.confirmed !== true) {
      return {
        error:
          "confirmation required: caller must explicitly confirm cancellation",
      }
    }
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const reason = asString(args.reason) ?? "cancelled by customer via AI call"
    return commit(
      `cancel order ${orderId} (reason: "${reason}"), tag "cod:cancelled_by_customer"`,
      async () => {
        // Tag + audit first so provenance survives regardless of cancel side-effects.
        const res = await applyOrderWrite(ctx, orderId, {
          addTags: ["cod:cancelled_by_customer"],
          audit: { action: "cancelOrder", reason },
        })
        await ctx.gateway.cancelOrder(ctx.tenantId, orderId, reason)
        return { ...res, cancelled: true, reason }
      }
    )
  },
}

/**
 * flagOrder (LOW) — flag for fraud review and leave a note.
 */
const flagOrder: Tool = {
  name: "flagOrder",
  risk: "low",
  write: true,
  handler: async (ctx, args) => {
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    const reason = asString(args.reason) ?? "flagged for fraud review"
    return commit(
      `flag order ${orderId} for fraud review (tag "cod:fraud_review")`,
      async () => {
        const order = await ctx.gateway.getOrder(ctx.tenantId, orderId)
        if (!order) {
          throw new Error(`order ${orderId} not found`)
        }
        const md = order.metadata ?? {}
        const notes = Array.isArray(md.cc_notes)
          ? (md.cc_notes as unknown[])
          : []
        const note = {
          at: new Date().toISOString(),
          source: "ai_call",
          call_id: ctx.callId,
          text: reason,
        }
        const res = await applyOrderWrite(ctx, orderId, {
          patch: { cc_notes: [...notes, note] },
          addTags: ["cod:fraud_review"],
          audit: { action: "flagOrder", reason },
        })
        return { ...res, flagged: true, reason }
      }
    )
  },
}

/**
 * addOrderNote (LOW) — append a free-text note to the order's `cc_notes`.
 */
const addOrderNote: Tool = {
  name: "addOrderNote",
  risk: "low",
  write: true,
  handler: async (ctx, args) => {
    const text = asString(args.note) ?? asString(args.text)
    if (!text) {
      return { error: "note is required" }
    }
    const orderId = await resolveOrderId(ctx, args)
    if (!orderId) {
      return { error: "order_id is required (no order linked to this call)" }
    }
    return commit(`append note to order ${orderId}: "${text}"`, async () => {
      const order = await ctx.gateway.getOrder(ctx.tenantId, orderId)
      if (!order) {
        throw new Error(`order ${orderId} not found`)
      }
      const md = order.metadata ?? {}
      const notes = Array.isArray(md.cc_notes)
        ? (md.cc_notes as unknown[])
        : []
      const note = {
        at: new Date().toISOString(),
        source: "ai_call",
        call_id: ctx.callId,
        text,
      }
      await ctx.gateway.updateOrderMetadata(ctx.tenantId, orderId, {
        cc_notes: [...notes, note],
      })
      return { order_id: orderId, note }
    })
  },
}

/**
 * setDisposition (LOW) — record the structured outcome of the call.
 */
const setDisposition: Tool = {
  name: "setDisposition",
  risk: "low",
  write: true,
  handler: async (ctx, args) => {
    const outcome = asString(args.outcome)
    if (!outcome) {
      return { error: "outcome is required" }
    }
    return commit(
      `record disposition "${outcome}" for call ${ctx.callId}`,
      async () => {
        const call = await findCall(ctx)
        const created = await ctx.cc.createDispositions({
          tenant_id: ctx.tenantId,
          call_id: call?.id ?? ctx.callId,
          outcome,
          reason: asString(args.reason) ?? null,
          notes: asString(args.notes) ?? null,
          set_by: "ai_call",
        })
        return { disposition: created }
      }
    )
  },
}

/**
 * transferToHuman (NONE) — hand the live call to a human agent. Returns
 * `action: "transfer"` so the runtime routes the call. Marks the call
 * needs-human; in SHADOW MODE it still returns the transfer action (so the
 * call flow works) without mutating the record.
 */
const transferToHuman: Tool = {
  name: "transferToHuman",
  risk: "none",
  write: true,
  handler: async (ctx) => {
    const res = await commit(
      "mark the call as needs-human and transfer to a human agent",
      async () => {
        const call = await findCall(ctx)
        if (call) {
          await ctx.cc.updateCalls({
            id: call.id,
            disposition: "transfer_to_human",
          })
        }
        return { transferred: true }
      }
    )
    return { ...res, action: "transfer" }
  },
}

/**
 * endCall (NONE) — signal the runtime to hang up. Pure control action, no
 * mutation.
 */
const endCall: Tool = {
  name: "endCall",
  risk: "none",
  write: false,
  handler: async () => ({ result: { ended: true }, action: "end_call" }),
}

/**
 * searchKnowledge (READ) — retrieve this agent's own knowledge base to answer a
 * store-specific question (policies, FAQ, shipping/returns rules, product notes)
 * the agent cannot get from a live order/product lookup. Tenant + agent scoped:
 * the agent is resolved from the CALL ROW (call_id -> playbook_id), never from
 * arguments, and retrieval only ever loads {tenant_id, agent_id} chunks.
 */
const searchKnowledge: Tool = {
  name: "searchKnowledge",
  risk: "none",
  write: false,
  handler: async (ctx, args) => {
    const query = asString(args.query) ?? asString(args.q)
    if (!query) {
      return { error: "query is required" }
    }
    const call = await findCall(ctx)
    const agentId = (call?.playbook_id as string | undefined) ?? undefined
    if (!agentId) {
      return { error: "no agent is linked to this call" }
    }
    const hits = await retrieveKnowledge(
      ctx.cc,
      ctx.tenantId,
      agentId,
      query
    )
    if (!hits.length) {
      return {
        result: {
          snippets: [],
          note: "no relevant knowledge found for this query",
        },
      }
    }
    return {
      result: {
        snippets: hits.map((h) => ({
          text: h.content,
          score: Number(h.score.toFixed(3)),
        })),
      },
    }
  },
}

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

/** Name -> Tool. The route resolves tools exclusively through this map. */
export const toolRegistry: Record<string, Tool> = {
  [getOrder.name]: getOrder,
  [getOrderStatus.name]: getOrderStatus,
  [findOrders.name]: findOrders,
  [listCustomerOrders.name]: listCustomerOrders,
  [searchProducts.name]: searchProducts,
  [getProduct.name]: getProduct,
  [confirmOrder.name]: confirmOrder,
  [rescheduleDelivery.name]: rescheduleDelivery,
  [updateShippingAddress.name]: updateShippingAddress,
  [cancelOrder.name]: cancelOrder,
  [flagOrder.name]: flagOrder,
  [addOrderNote.name]: addOrderNote,
  [setDisposition.name]: setDisposition,
  [transferToHuman.name]: transferToHuman,
  [endCall.name]: endCall,
  [searchKnowledge.name]: searchKnowledge,
}

/** Look up a tool by name (undefined if the runtime asked for an unknown one). */
export const getTool = (name: string): Tool | undefined => toolRegistry[name]
