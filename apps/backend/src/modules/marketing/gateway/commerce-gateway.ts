/**
 * CommerceGateway — platform-agnostic commerce abstraction (marketing edition).
 *
 * This is the ONLY surface the marketing core is allowed to depend on when it
 * needs to read or mutate commerce data (products, categories, orders,
 * customers). It deliberately leaks NO backend types: every shape below is a
 * normalized DTO owned by the marketing module, so a future non-Medusa store
 * just needs a new adapter class that implements `CommerceGateway` — no core
 * changes required.
 *
 * This contract is copied from the call-center gateway (orders + customers) and
 * EXTENDED with the product/category reads the marketing side needs (compose a
 * post about a product, tag a campaign to a category, etc.). The order/customer
 * surface is kept intact so a marketing inbox can be commerce-aware.
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

/** A single normalized product variant. */
export type CommerceProductVariant = {
  id: string
  title: string | null
  sku: string | null
}

/**
 * A normalized product — the object marketing reasons about when composing a
 * post, building a catalog ad, or linking a campaign to a SKU. Pricing is a
 * single representative price (first variant's calculated price) rather than the
 * full price-set, which is all a post/ad preview needs.
 */
export type CommerceProduct = {
  id: string
  title: string | null
  subtitle: string | null
  description: string | null
  handle: string | null
  status: string | null
  thumbnail: string | null
  images: string[]
  price: number | null
  currency_code: string | null
  variants: CommerceProductVariant[]
  collection_id: string | null
  category_ids: string[]
  tags: string[]
  metadata: Record<string, unknown>
}

/** A normalized product category. */
export type CommerceCategory = {
  id: string
  name: string | null
  handle: string | null
  description: string | null
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

/** Filter for `queryProducts`. All fields optional; unset fields are not constrained. */
export type ProductFilter = {
  status?: string
  collection_id?: string
  category_id?: string
  /** Free-text query (title/handle); adapter decides how to interpret. */
  q?: string
  limit?: number
  offset?: number
}

/**
 * The commerce backend contract. Reads return normalized DTOs (or null / empty
 * arrays when nothing matches — reads never throw for "not found"). Writes are
 * fire-and-forget from the caller's perspective (return void) and may throw on
 * genuine errors (unknown id, backend failure).
 */
/** A single normalized cart line item. */
export type CommerceCartLineItem = {
  id: string
  title: string | null
  quantity: number
  unit_price: number
  thumbnail: string | null
  product_id: string | null
  variant_id: string | null
  product_handle: string | null
}

/**
 * A normalized cart — what abandoned-cart recovery reasons about. `completed_at`
 * null means it never became an order; `email` is the reachable address (present
 * once the customer reached the email/address step).
 */
export type CommerceCart = {
  id: string
  email: string | null
  customer_id: string | null
  currency_code: string | null
  items: CommerceCartLineItem[]
  item_count: number
  total: number
  updated_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown>
}

/** Filter for `listAbandonedCarts`. */
export type AbandonedCartFilter = {
  /** Only carts idle (no update) for at least this many minutes. */
  idleSinceMinutes: number
  /** Optional upper bound so very old carts aren't re-swept forever. */
  idleUntilMinutes?: number
  limit?: number
}

/** A recovery incentive to attach to a recovery message. */
export type RecoveryDiscountInput = {
  /** Percentage off (1–100). Provide this OR `amount`. */
  percentage?: number
  /** Fixed amount off (in the cart's currency major units). */
  amount?: number
  currencyCode?: string
  /** Hours until the code expires. */
  expiresInHours?: number
  /** Optional human-readable code prefix (default "COMEBACK"). */
  codePrefix?: string
}

export interface CommerceGateway {
  // ---------------------------------------------------------------------------
  // Catalog reads (marketing surface)
  // ---------------------------------------------------------------------------

  /** Fetch one product by id, or null if it does not exist. */
  getProduct(tenantId: string, id: string): Promise<CommerceProduct | null>

  /** List products matching `filter`, with pagination. */
  queryProducts(
    tenantId: string,
    filter: ProductFilter
  ): Promise<CommerceProduct[]>

  /** Fetch one product category by id, or null if it does not exist. */
  getCategory(tenantId: string, id: string): Promise<CommerceCategory | null>

  // ---------------------------------------------------------------------------
  // Order + customer reads/writes (kept for a commerce-aware inbox)
  // ---------------------------------------------------------------------------

  /** Fetch one order by id, or null if it does not exist. */
  getOrder(tenantId: string, orderId: string): Promise<CommerceOrder | null>

  /** List orders matching `filter`, newest-first. */
  queryOrders(tenantId: string, filter: OrderFilter): Promise<CommerceOrder[]>

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
   * Replace the marketing tag set on an order. Tags are a marketing concept
   * stored in order metadata; they are not the backend's own tagging system.
   */
  setOrderTags(tenantId: string, orderId: string, tags: string[]): Promise<void>

  /** Cancel an order, recording `reason`. */
  cancelOrder(tenantId: string, orderId: string, reason: string): Promise<void>

  /**
   * Fulfillment hold — a construct owned by our own modules, not a native
   * backend feature. Setting `held = true` marks the order so our own
   * fulfillment path will refuse to ship it. See `isFulfillmentHeld`.
   */
  markFulfillmentHold(
    tenantId: string,
    orderId: string,
    held: boolean
  ): Promise<void>

  /** Whether the order is currently on fulfillment hold (see `markFulfillmentHold`). */
  isFulfillmentHeld(tenantId: string, orderId: string): Promise<boolean>

  // ---------------------------------------------------------------------------
  // Cart reads + recovery (abandoned-cart recovery)
  // ---------------------------------------------------------------------------

  /**
   * List abandoned carts: `completed_at` null, has an `email`, has items, and
   * idle (no update) within the filter's window. Newest-idle first.
   */
  listAbandonedCarts(
    tenantId: string,
    filter: AbandonedCartFilter
  ): Promise<CommerceCart[]>

  /** Fetch one cart with its line items, or null if it does not exist. */
  getCart(tenantId: string, cartId: string): Promise<CommerceCart | null>

  /**
   * Create a one-time recovery discount + code (unique, usage-limited, expiring)
   * and return the code + promotion id, or null if promotions are unavailable.
   */
  createRecoveryDiscount(
    tenantId: string,
    input: RecoveryDiscountInput
  ): Promise<{ code: string; promotionId: string } | null>
}
