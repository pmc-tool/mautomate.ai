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
