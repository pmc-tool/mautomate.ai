/**
 * CommerceGateway — platform-agnostic commerce abstraction.
 *
 * This is the ONLY surface the AI call-center core is allowed to depend on when
 * it needs to read or mutate commerce data (orders, customers). It deliberately
 * leaks NO backend types: every shape below is a normalized DTO owned by the
 * call-center, so a future non-Medusa store just needs a new adapter class that
 * implements `CommerceGateway` — no core changes required.
 *
 * Tenancy: every method takes `tenantId` as its first argument. Today the store
 * is single-tenant and the id is accepted-but-unscoped, but wiring it through
 * now means real per-store / per-sales-channel scoping is an adapter-only change
 * later (see the `TODO(tenancy)` markers in the Medusa adapter).
 */

/** A single normalized line on an order. */
export type CommerceLineItem = {
  title: string
  quantity: number
  variant_id: string | null
  product_id: string | null
}

/** A normalized postal address (used for both orders and customers). */
export type CommerceAddress = {
  name: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
}

/** Normalized payment state of an order. Mirrors the common commerce vocabulary. */
export type CommercePaymentStatus =
  | "not_paid"
  | "awaiting"
  | "authorized"
  | "partially_authorized"
  | "captured"
  | "partially_captured"
  | "partially_refunded"
  | "refunded"
  | "canceled"
  | "requires_action"
  | (string & {})

/** Normalized fulfillment state of an order. */
export type CommerceFulfillmentStatus =
  | "not_fulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_shipped"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "canceled"
  | (string & {})

/** Normalized lifecycle state of an order. */
export type CommerceOrderStatus =
  | "pending"
  | "completed"
  | "draft"
  | "archived"
  | "canceled"
  | "requires_action"
  | (string & {})

/** A tracking number the carrier gave back, and where to follow it. */
export type OrderTracking = {
  number: string | null
  url: string | null
}

export type OrderStage =
  | "canceled"
  | "delivered"
  | "shipped"
  | "packed"
  | "preparing"
  | "awaiting_payment"

/**
 * Where an order actually stands, in one answer, ready to say to a customer.
 *
 * This exists because the raw order carries three flags that routinely disagree
 * — `status` ("pending" is Medusa's word for "not archived", NOT "unpaid"),
 * `payment_status`, and `fulfillment_status` — and any agent handed all three
 * will read the contradiction out loud. A real customer was told "your payment
 * has not been received, but it shows as shipped" about an order that had been
 * paid in full days earlier and was already in transit.
 */
export type OrderProgress = {
  stage: OrderStage
  /** The status, as a customer would say it: "Shipped — on its way". */
  headline: string
  /** One sentence of context: when it shipped, whether there is tracking. */
  detail: string
  /** True ONLY when the customer genuinely still owes money on something unshipped. */
  awaiting_payment: boolean
}

/** A normalized order — the central object the call-center reasons about. */
export type CommerceOrder = {
  id: string
  display_id: number | null
  email: string | null
  phone: string | null
  currency_code: string | null
  total: number
  payment_status: CommercePaymentStatus | null
  fulfillment_status: CommerceFulfillmentStatus | null
  status: CommerceOrderStatus | null
  items: CommerceLineItem[]
  shipping_address: CommerceAddress | null
  customer_id: string | null
  created_at: string | null
  metadata: Record<string, unknown>

  // --- Enriched on single-order reads (getOrder). Absent on list reads, where
  // fetching them per row would be an N+1 nobody asked for.

  /** What has actually been paid, from the order summary. Beats `payment_status`. */
  paid_total?: number | null
  /** Still owed. <= 0 means settled. */
  pending_difference?: number | null
  tracking?: OrderTracking[]
  shipped_at?: string | null
  delivered_at?: string | null
  /** The one status to tell a customer. Prefer this over the raw flags. */
  progress?: OrderProgress | null
}

const onDay = (v: any): string => {
  if (!v) return ""
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
}

/**
 * Derive the ONE status a customer should be told.
 *
 * THE RULE: payment is only the customer's business while nothing has shipped.
 * Once a parcel is on its way, the payment flag is an internal accounting matter
 * — telling the buyer their money never arrived is both wrong and alarming.
 *
 * `paid` must come from the order summary (paid_total / pending_difference), not
 * from `payment_status`: Medusa computes that flag off a stale order version and
 * reports "not_paid" for orders that are settled in full.
 */
export const deriveOrderProgress = (input: {
  status: string | null
  fulfillment_status: string | null
  paid: boolean
  tracking: OrderTracking[]
  shipped_at: string | null
  delivered_at: string | null
  canceled_at?: string | null
}): OrderProgress => {
  const fulfillment = String(input.fulfillment_status ?? "")

  if (String(input.status ?? "") === "canceled" || input.canceled_at) {
    return {
      stage: "canceled",
      headline: "Cancelled",
      detail: "This order was cancelled.",
      awaiting_payment: false,
    }
  }

  if (fulfillment === "delivered" || input.delivered_at) {
    const when = onDay(input.delivered_at)
    return {
      stage: "delivered",
      headline: "Delivered",
      detail: when ? `It was delivered on ${when}.` : "It has been delivered.",
      awaiting_payment: false,
    }
  }

  if (
    fulfillment === "shipped" ||
    fulfillment === "partially_shipped" ||
    input.shipped_at
  ) {
    const when = onDay(input.shipped_at)
    const hasTracking = input.tracking.some((t) => t.number)
    return {
      stage: "shipped",
      headline: "Shipped — on its way",
      detail: [
        when ? `It left the warehouse on ${when}.` : "It is on its way.",
        hasTracking
          ? "A tracking number is available."
          : "The carrier has not given us a tracking number for it yet.",
      ].join(" "),
      awaiting_payment: false,
    }
  }

  if (fulfillment === "fulfilled" || fulfillment === "partially_fulfilled") {
    return {
      stage: "packed",
      headline: "Packed — awaiting collection",
      detail: "It is packed and waiting for the carrier to collect it.",
      awaiting_payment: false,
    }
  }

  // Nothing has shipped. Only NOW does payment concern the customer.
  if (!input.paid) {
    return {
      stage: "awaiting_payment",
      headline: "Awaiting payment",
      detail: "We have not received payment for this order yet.",
      awaiting_payment: true,
    }
  }

  return {
    stage: "preparing",
    headline: "Being prepared",
    detail: "It is confirmed and being prepared for shipping.",
    awaiting_payment: false,
  }
}

/** A normalized customer. */
export type CommerceCustomer = {
  id: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  has_account: boolean
  addresses: CommerceAddress[]
}

/** A single normalized purchasable variant of a product. */
export type CommerceProductVariant = {
  id: string
  title: string | null
  sku: string | null
  /** Price amount for the tenant region's currency (raw price-set amount). */
  price: number | null
  currency_code: string | null
  in_stock: boolean
  inventory_quantity: number
}

/** A normalized catalog product (used to answer stock / price questions). */
export type CommerceProduct = {
  id: string
  title: string | null
  handle: string | null
  description: string | null
  status: string | null
  thumbnail: string | null
  variants: CommerceProductVariant[]
  /** Cheapest variant price in the region's currency (or null if none priced). */
  min_price: number | null
  currency_code: string | null
}

/** Lookup args for `findOrders` — any combination; unset fields are not constrained. */
export type OrderLookup = {
  /** Human order number (e.g. "1005" or "#1005"); coerced to `display_id`. */
  display_id?: string | number
  /** Spoken-friendly numeric support code (metadata.support_code). */
  code?: string
  email?: string
  phone?: string
}

/** Lookup args for `listCustomerOrders`. At least one identifier is expected. */
export type CustomerOrderLookup = {
  email?: string
  phone?: string
  /**
   * The authoritative link. When the shopper is SIGNED IN the storefront has
   * already proven who they are, so their orders are found by customer id — not
   * by an email they would otherwise have to type out and we would have to trust.
   */
  customer_id?: string
}

/** Filter for `queryOrders`. All fields optional; unset fields are not constrained. */
export type OrderFilter = {
  payment_status?: CommercePaymentStatus
  fulfillment_status?: CommerceFulfillmentStatus
  status?: CommerceOrderStatus
  /** ISO-8601 string or epoch ms; adapter decides how to interpret. */
  created_after?: string | number
  region_id?: string
  country_code?: string
  limit?: number
  offset?: number
}

/**
 * The commerce backend contract. Reads return normalized DTOs (or null / empty
 * arrays when nothing matches — reads never throw for "not found"). Writes are
 * fire-and-forget from the caller's perspective (return void) and may throw on
 * genuine errors (unknown id, backend failure).
 */
export interface CommerceGateway {
  /** Fetch one order by id, or null if it does not exist. */
  getOrder(tenantId: string, orderId: string): Promise<CommerceOrder | null>

  /** List orders matching `filter`, newest-first. */
  queryOrders(tenantId: string, filter: OrderFilter): Promise<CommerceOrder[]>

  /**
   * Look up orders by human order number / email / phone. Always scoped to the
   * tenant's sales channel (fail-closed: no sales channel -> empty). Newest-first.
   */
  findOrders(tenantId: string, lookup: OrderLookup): Promise<CommerceOrder[]>

  /**
   * List a caller's orders by their email or phone. Always scoped to the
   * tenant's sales channel (fail-closed). Newest-first.
   */
  listCustomerOrders(
    tenantId: string,
    lookup: CustomerOrderLookup
  ): Promise<CommerceOrder[]>

  /**
   * Free-text search the tenant's catalog (title / handle / description). Only
   * returns products in the tenant's sales channel (fail-closed).
   */
  searchProducts(
    tenantId: string,
    query: string,
    limit?: number
  ): Promise<CommerceProduct[]>

  /**
   * Fetch one product by id or handle, or null. Returns null unless the product
   * is in the tenant's sales channel (fail-closed).
   */
  getProduct(
    tenantId: string,
    idOrHandle: string
  ): Promise<CommerceProduct | null>

  /** Fetch one customer by id, or null if it does not exist. */
  getCustomer(
    tenantId: string,
    customerId: string
  ): Promise<CommerceCustomer | null>

  /**
   * Find customers by an E.164 phone number. Implementations should also match
   * guests who have no customer account but placed an order with this phone on
   * the shipping address.
   */
  findCustomersByPhone(
    tenantId: string,
    phoneE164: string
  ): Promise<CommerceCustomer[]>

  /** Shallow-merge `patch` into the order's metadata. */
  updateOrderMetadata(
    tenantId: string,
    orderId: string,
    patch: Record<string, unknown>
  ): Promise<void>

  /**
   * Replace the call-center tag set on an order. Tags are a call-center concept
   * stored in order metadata; they are not the backend's own tagging system.
   */
  setOrderTags(tenantId: string, orderId: string, tags: string[]): Promise<void>

  /** Cancel an order, recording `reason`. */
  cancelOrder(tenantId: string, orderId: string, reason: string): Promise<void>

  /**
   * Fulfillment hold — a CALL-CENTER construct, not a native backend feature.
   * Setting `held = true` marks the order so our own dialer / any custom
   * fulfillment path will refuse to ship it. See `isFulfillmentHeld`.
   */
  markFulfillmentHold(
    tenantId: string,
    orderId: string,
    held: boolean
  ): Promise<void>

  /** Whether the order is currently on fulfillment hold (see `markFulfillmentHold`). */
  isFulfillmentHeld(tenantId: string, orderId: string): Promise<boolean>
}
