import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow } from "@medusajs/core-flows"

import {
  AbandonedCartFilter,
  CommerceAddress,
  CommerceCart,
  CommerceCartLineItem,
  CommerceCategory,
  CommerceCustomer,
  CommerceGateway,
  CommerceLineItem,
  CommerceOrder,
  CommerceProduct,
  CommerceProductVariant,
  OrderFilter,
  ProductFilter,
  RecoveryDiscountInput,
} from "./commerce-gateway"

/**
 * Metadata key under which we store the fulfillment-hold flag.
 *
 * IMPORTANT: Medusa has NO native concept of a fulfillment hold — it does NOT
 * gate any fulfillment on this flag. It is purely one of our own constructs.
 * Therefore any custom fulfillment path (subscribers, workflows, manual admin
 * actions we own) MUST read this flag via `isFulfillmentHeld` and refuse to
 * ship when it is `true`. Nothing in stock Medusa enforces it for us.
 */
const FULFILLMENT_HOLD_KEY = "cc_fulfillment_hold"

/**
 * Metadata key under which we store the tag set (see `setOrderTags`). These are
 * marketing/call-center tags, distinct from any backend-native tagging system.
 */
const ORDER_TAGS_KEY = "cc_tags"

/** Fields fetched for a full order graph (order -> items -> shipping_address -> customer). */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "payment_status",
  "fulfillment_status",
  "status",
  "customer_id",
  "created_at",
  "metadata",
  "items.title",
  "items.quantity",
  "items.variant_id",
  "items.product_id",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "customer.phone",
]

const CUSTOMER_FIELDS = [
  "id",
  "email",
  "phone",
  "first_name",
  "last_name",
  "has_account",
  "addresses.first_name",
  "addresses.last_name",
  "addresses.phone",
  "addresses.address_1",
  "addresses.address_2",
  "addresses.city",
  "addresses.province",
  "addresses.postal_code",
  "addresses.country_code",
]

/**
 * Fields fetched for a full product graph. `*variants.calculated_price` pulls
 * the price context so a representative price can be derived from the first
 * variant. `images.url` / `tags.value` / `categories.id` are relation fields
 * flattened during mapping.
 */
const PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "status",
  "thumbnail",
  "images.url",
  "variants.id",
  "variants.title",
  "variants.sku",
  "*variants.calculated_price",
  "collection_id",
  "categories.id",
  "tags.value",
  "metadata",
]

const CATEGORY_FIELDS = ["id", "name", "handle", "description"]

/**
 * Fields fetched for a cart graph (cart -> items -> item.product). `total` is the
 * cart module's computed grand total; it is preferred when present and falls back
 * to a sum of `unit_price * quantity` when the graph does not populate it.
 */
const CART_FIELDS = [
  "id",
  "email",
  "customer_id",
  "currency_code",
  "total",
  "completed_at",
  "updated_at",
  "metadata",
  "items.id",
  "items.title",
  "items.quantity",
  "items.unit_price",
  "items.thumbnail",
  "items.product_id",
  "items.variant_id",
  "items.product.handle",
]

/**
 * Medusa-backed implementation of `CommerceGateway`.
 *
 * Reads go through the Query graph (one round-trip joins the entity to its
 * relations). Writes go through the module services (Modules.ORDER /
 * Modules.CUSTOMER). Everything is mapped to the normalized, backend-agnostic
 * DTOs before it leaves this class.
 *
 * `tenantId` is currently accepted-but-unscoped (single-tenant store). Every
 * place it would eventually constrain a query/write is marked with
 * `TODO(tenancy)`.
 */
export class MedusaCommerceGateway implements CommerceGateway {
  private readonly container: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container = container
  }

  private get query() {
    return this.container.resolve(ContainerRegistrationKeys.QUERY)
  }

  private get orderService(): any {
    return this.container.resolve(Modules.ORDER)
  }

  private get customerService(): any {
    return this.container.resolve(Modules.CUSTOMER)
  }

  private get cartService(): any {
    return this.container.resolve(Modules.CART)
  }

  // ---------------------------------------------------------------------------
  // Catalog reads (marketing surface)
  // ---------------------------------------------------------------------------

  async getProduct(
    tenantId: string,
    id: string
  ): Promise<CommerceProduct | null> {
    // TODO(tenancy): scope by store/sales_channel — add e.g.
    // `sales_channel_id: tenantToSalesChannel(tenantId)` to the filters below.
    const { data } = await this.query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters: { id },
    })

    const product = data?.[0]
    return product ? this.toCommerceProduct(product) : null
  }

  async queryProducts(
    tenantId: string,
    filter: ProductFilter
  ): Promise<CommerceProduct[]> {
    const filters: Record<string, unknown> = {}

    if (filter.status) {
      filters.status = filter.status
    }
    if (filter.collection_id) {
      filters.collection_id = filter.collection_id
    }
    if (filter.category_id) {
      // Filter by a linked category id (relation filter on the product graph).
      // TODO(verify): confirm `categories: { id }` relation-filter syntax for
      // the product entity in this Medusa version.
      filters.categories = { id: filter.category_id }
    }
    if (filter.q) {
      // Free-text search. Query graph exposes `q` as a top-level search token
      // on catalog entities.
      // TODO(verify): confirm `q` free-text search key is honored by the
      // product Query graph in this Medusa version (else map to a title filter).
      filters.q = filter.q
    }
    // TODO(tenancy): scope by store/sales_channel here as well.

    const { data } = await this.query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters,
      pagination: {
        skip: filter.offset ?? 0,
        take: filter.limit ?? 50,
      },
    })

    return (data ?? []).map((p: any) => this.toCommerceProduct(p))
  }

  async getCategory(
    tenantId: string,
    id: string
  ): Promise<CommerceCategory | null> {
    // TODO(tenancy): scope by store/sales_channel.
    const { data } = await this.query.graph({
      entity: "product_category",
      fields: CATEGORY_FIELDS,
      filters: { id },
    })

    const category = data?.[0]
    return category ? this.toCommerceCategory(category) : null
  }

  // ---------------------------------------------------------------------------
  // Order + customer reads
  // ---------------------------------------------------------------------------

  async getOrder(
    tenantId: string,
    orderId: string
  ): Promise<CommerceOrder | null> {
    // TODO(tenancy): scope by store/sales_channel — add e.g.
    // `sales_channel_id: tenantToSalesChannel(tenantId)` to the filters below.
    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: orderId },
    })

    const order = data?.[0]
    return order ? this.toCommerceOrder(order) : null
  }

  async queryOrders(
    tenantId: string,
    filter: OrderFilter
  ): Promise<CommerceOrder[]> {
    const filters: Record<string, unknown> = {}

    if (filter.payment_status) {
      filters.payment_status = filter.payment_status
    }
    if (filter.fulfillment_status) {
      filters.fulfillment_status = filter.fulfillment_status
    }
    if (filter.status) {
      filters.status = filter.status
    }
    if (filter.region_id) {
      filters.region_id = filter.region_id
    }
    if (filter.created_after !== undefined) {
      // Query graph supports operator filters via `$gt`.
      // TODO(verify): confirm `created_at: { $gt }` operator syntax for the
      // order entity in this Medusa version.
      filters.created_at = { $gt: this.toDate(filter.created_after) }
    }
    // TODO(tenancy): scope by store/sales_channel here as well.

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters,
      pagination: {
        skip: filter.offset ?? 0,
        take: filter.limit ?? 50,
        order: { created_at: "DESC" },
      },
    })

    let orders = (data ?? []).map((o: any) => this.toCommerceOrder(o))

    // `country_code` lives on the shipping address, not a top-level order
    // column, so it is filtered in-memory after the join.
    if (filter.country_code) {
      const cc = filter.country_code.toLowerCase()
      orders = orders.filter(
        (o: CommerceOrder) =>
          o.shipping_address?.country_code?.toLowerCase() === cc
      )
    }

    return orders
  }

  async getCustomer(
    tenantId: string,
    customerId: string
  ): Promise<CommerceCustomer | null> {
    // TODO(tenancy): scope by store/sales_channel.
    const { data } = await this.query.graph({
      entity: "customer",
      fields: CUSTOMER_FIELDS,
      filters: { id: customerId },
    })

    const customer = data?.[0]
    return customer ? this.toCommerceCustomer(customer) : null
  }

  async findCustomersByPhone(
    tenantId: string,
    phoneE164: string
  ): Promise<CommerceCustomer[]> {
    // TODO(tenancy): scope by store/sales_channel on both queries below.

    // 1. Registered customers whose account phone matches.
    const { data: customerRows } = await this.query.graph({
      entity: "customer",
      fields: CUSTOMER_FIELDS,
      filters: { phone: phoneE164 },
    })

    const results: CommerceCustomer[] = (customerRows ?? []).map((c: any) =>
      this.toCommerceCustomer(c)
    )
    const seen = new Set(results.map((c) => c.id))

    // 2. Guests: match orders whose shipping_address.phone equals the number,
    //    and surface a synthetic customer for each unique guest that is not
    //    already covered by a registered account above.
    // Medusa's order Query-graph filters don't support a nested
    // shipping_address.phone predicate, so fetch a bounded recent window and
    // match in-memory (the loop below re-checks addr.phone).
    // TODO(perf): index guest phones (a dedicated phone column / search index)
    // instead of scanning recent orders once this is on the live inbound path.
    const { data: orderRows } = await this.query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "customer_id",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.phone",
        "shipping_address.address_1",
        "shipping_address.address_2",
        "shipping_address.city",
        "shipping_address.province",
        "shipping_address.postal_code",
        "shipping_address.country_code",
      ],
      pagination: { take: 500, order: { created_at: "DESC" } },
    })

    for (const order of orderRows ?? []) {
      const addr = order?.shipping_address
      if (!addr || addr.phone !== phoneE164) {
        continue
      }
      // If this order belongs to a registered customer we already returned,
      // skip — that account is the better record.
      if (order.customer_id && seen.has(order.customer_id)) {
        continue
      }

      // Key guests by customer_id when present, otherwise by the phone itself
      // so we do not emit one synthetic record per guest order.
      const guestKey = order.customer_id ?? `guest:${phoneE164}`
      if (seen.has(guestKey)) {
        continue
      }
      seen.add(guestKey)

      results.push({
        id: order.customer_id ?? guestKey,
        email: order.email ?? null,
        phone: phoneE164,
        first_name: addr.first_name ?? null,
        last_name: addr.last_name ?? null,
        has_account: Boolean(order.customer_id),
        addresses: [this.toCommerceAddress(addr)].filter(
          (a): a is CommerceAddress => a !== null
        ),
      })
    }

    return results
  }

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  async updateOrderMetadata(
    tenantId: string,
    orderId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    // TODO(tenancy): verify the order belongs to `tenantId` before mutating.
    const current = await this.readOrderMetadata(orderId)
    const metadata = { ...current, ...patch }
    // updateOrders(orderId, data) overload.
    await this.orderService.updateOrders(orderId, { metadata })
  }

  async setOrderTags(
    tenantId: string,
    orderId: string,
    tags: string[]
  ): Promise<void> {
    // Tags are a marketing/call-center concept persisted in order metadata.
    await this.updateOrderMetadata(tenantId, orderId, {
      [ORDER_TAGS_KEY]: tags,
    })
  }

  async cancelOrder(
    tenantId: string,
    orderId: string,
    reason: string
  ): Promise<void> {
    // TODO(tenancy): verify the order belongs to `tenantId` before cancelling.

    // Record the reason in metadata first so it survives regardless of how the
    // cancel path stores its own bookkeeping.
    await this.updateOrderMetadata(tenantId, orderId, {
      cc_cancel_reason: reason,
      cc_canceled_at: new Date().toISOString(),
    })

    // TODO(verify): `cancel(orderId)` is the order module's cancel entrypoint.
    // Depending on business rules you may instead want to run the
    // `cancelOrderWorkflow` from @medusajs/core-flows so payment/fulfillment
    // side-effects and validations run. This does a direct module cancel.
    await this.orderService.cancel(orderId)
  }

  async markFulfillmentHold(
    tenantId: string,
    orderId: string,
    held: boolean
  ): Promise<void> {
    // Purely one of our own flags — see FULFILLMENT_HOLD_KEY note. Nothing in
    // Medusa reacts to this; our own fulfillment path must honor it.
    await this.updateOrderMetadata(tenantId, orderId, {
      [FULFILLMENT_HOLD_KEY]: held,
    })
  }

  async isFulfillmentHeld(tenantId: string, orderId: string): Promise<boolean> {
    const metadata = await this.readOrderMetadata(orderId)
    return metadata[FULFILLMENT_HOLD_KEY] === true
  }

  // ---------------------------------------------------------------------------
  // Cart reads + recovery (abandoned-cart recovery)
  // ---------------------------------------------------------------------------

  async getCart(
    tenantId: string,
    cartId: string
  ): Promise<CommerceCart | null> {
    // TODO(tenancy): scope by store/sales_channel.
    try {
      const { data } = await this.query.graph({
        entity: "cart",
        fields: CART_FIELDS,
        filters: { id: cartId },
      })

      const cart = data?.[0]
      return cart ? this.toCommerceCart(cart) : null
    } catch {
      // Reads never throw for "not found"/backend failure — surface null.
      return null
    }
  }

  async listAbandonedCarts(
    tenantId: string,
    filter: AbandonedCartFilter
  ): Promise<CommerceCart[]> {
    // TODO(tenancy): scope by store/sales_channel.
    const now = Date.now()
    const cutoff = new Date(now - filter.idleSinceMinutes * 60000)
    const floor = filter.idleUntilMinutes
      ? new Date(now - filter.idleUntilMinutes * 60000)
      : null
    const limit = filter.limit ?? 200

    // WHICH PATH WORKED: the primary Query-graph path with `$lt`/`$gt` operators
    // on `updated_at`. Operator filters on the cart's timestamps are part of the
    // public contract — `FilterableCartProps.updated_at` / `.completed_at` are
    // typed as `OperatorMap<string>` in @medusajs/types — so the graph honors
    // them. We still re-verify the window in-code below (belt-and-braces) so a
    // silently-ignored operator can never leak carts outside the window, and we
    // fall back to the Cart module service if the graph call throws.
    let rows: any[] = []
    try {
      const { data } = await this.query.graph({
        entity: "cart",
        fields: CART_FIELDS,
        filters: {
          completed_at: null,
          updated_at: {
            $lt: cutoff,
            ...(floor ? { $gt: floor } : {}),
          },
        },
        pagination: {
          take: 500,
          order: { updated_at: "DESC" },
        },
      })
      rows = data ?? []
    } catch {
      // FALLBACK: operator filters unavailable via the graph — list through the
      // Cart module service (no timestamp predicate) and filter in-code below.
      try {
        rows = await this.cartService.listCarts(
          { completed_at: null },
          {
            take: 500,
            relations: ["items", "items.product"],
            order: { updated_at: "DESC" },
          }
        )
      } catch {
        return []
      }
    }

    const cutoffMs = cutoff.getTime()
    const floorMs = floor ? floor.getTime() : null

    const carts = (rows ?? [])
      .filter((c: any) => {
        // Never completed, reachable (has email), and non-empty.
        if (c.completed_at) {
          return false
        }
        if (!c.email) {
          return false
        }
        if (!Array.isArray(c.items) || c.items.length === 0) {
          return false
        }
        // Re-verify the idle window in-code (covers the module-service fallback
        // and any silently-ignored graph operator).
        const updatedMs = c.updated_at ? new Date(c.updated_at).getTime() : NaN
        if (!Number.isFinite(updatedMs)) {
          return false
        }
        if (updatedMs >= cutoffMs) {
          return false
        }
        if (floorMs !== null && updatedMs <= floorMs) {
          return false
        }
        return true
      })
      // Newest-idle first (most recently updated among the idle set).
      .sort((a: any, b: any) => {
        const av = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bv = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bv - av
      })
      .slice(0, limit)
      .map((c: any) => this.toCommerceCart(c))

    return carts
  }

  async createRecoveryDiscount(
    tenantId: string,
    input: RecoveryDiscountInput
  ): Promise<{ code: string; promotionId: string } | null> {
    // TODO(tenancy): scope the promotion to the store/sales_channel.
    try {
      // Guard: if neither percentage nor amount is supplied, default to 10% off.
      const usePercentage =
        input.percentage != null || input.amount == null
      const value = usePercentage ? input.percentage ?? 10 : input.amount!

      const prefix = input.codePrefix ?? "COMEBACK"
      const code = `${prefix}-${this.randomAlnum(6)}`

      const expiresInHours = input.expiresInHours ?? 72
      const endsAt = new Date(Date.now() + expiresInHours * 3600000)

      const { result } = await createPromotionsWorkflow(this.container).run({
        input: {
          promotionsData: [
            {
              code,
              type: "standard",
              status: "active",
              is_automatic: false,
              // One-time recovery code.
              limit: 1,
              application_method: {
                type: usePercentage ? "percentage" : "fixed",
                target_type: "order",
                allocation: "across",
                value,
                currency_code: input.currencyCode,
              },
              // Expiry is modeled as a campaign ending at `endsAt`.
              campaign: {
                name: `Recovery ${code}`,
                campaign_identifier: code,
                ends_at: endsAt,
              },
            },
          ],
        } as any,
      })

      const promotion = result?.[0]
      if (!promotion?.id) {
        return null
      }

      return { code: promotion.code ?? code, promotionId: promotion.id }
    } catch {
      // Promotions unavailable / creation failed — never throw.
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Fetch just the metadata bag for an order (used before a shallow merge). */
  private async readOrderMetadata(
    orderId: string
  ): Promise<Record<string, unknown>> {
    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })
    return (data?.[0]?.metadata as Record<string, unknown>) ?? {}
  }

  private toDate(value: string | number | Date): Date {
    return value instanceof Date ? value : new Date(value)
  }

  private toCommerceProduct(product: any): CommerceProduct {
    const images: string[] = (product.images ?? [])
      .map((img: any) => img?.url)
      .filter((u: unknown): u is string => typeof u === "string")

    const variants: CommerceProductVariant[] = (product.variants ?? []).map(
      (v: any) => ({
        id: v.id,
        title: v.title ?? null,
        sku: v.sku ?? null,
      })
    )

    const categoryIds: string[] = (product.categories ?? [])
      .map((c: any) => c?.id)
      .filter((id: unknown): id is string => typeof id === "string")

    const tags: string[] = (product.tags ?? [])
      .map((t: any) => t?.value)
      .filter((v: unknown): v is string => typeof v === "string")

    // Pick a representative price from the first variant's calculated price.
    // TODO(verify): confirm the price field shape — `calculated_price` is an
    // object; `calculated_amount` is the numeric price and `currency_code`
    // rides alongside it. Adjust here if the graph returns a different key.
    const firstVariant = product.variants?.[0]
    const calculated = firstVariant?.calculated_price
    const price =
      calculated?.calculated_amount != null
        ? this.toNumber(calculated.calculated_amount)
        : null
    const currency_code = calculated?.currency_code ?? null

    return {
      id: product.id,
      title: product.title ?? null,
      subtitle: product.subtitle ?? null,
      description: product.description ?? null,
      handle: product.handle ?? null,
      status: product.status ?? null,
      thumbnail: product.thumbnail ?? null,
      images,
      price,
      currency_code,
      variants,
      collection_id: product.collection_id ?? null,
      category_ids: categoryIds,
      tags,
      metadata: (product.metadata as Record<string, unknown>) ?? {},
    }
  }

  private toCommerceCart(cart: any): CommerceCart {
    const items: CommerceCartLineItem[] = (cart.items ?? []).map((it: any) => ({
      id: it.id,
      title: it.title ?? null,
      quantity: Number(it.quantity ?? 0),
      unit_price: this.toNumber(it.unit_price),
      thumbnail: it.thumbnail ?? null,
      product_id: it.product_id ?? null,
      variant_id: it.variant_id ?? null,
      product_handle: it.product?.handle ?? null,
    }))

    const itemCount = items.reduce((sum, it) => sum + it.quantity, 0)

    // Prefer the cart's own computed total when the graph populates it; fall
    // back to a sum of line unit_price * quantity otherwise.
    const graphTotal = this.toNumber(cart.total)
    const computedTotal = items.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    )
    const total = graphTotal > 0 ? graphTotal : computedTotal

    return {
      id: cart.id,
      email: cart.email ?? null,
      customer_id: cart.customer_id ?? null,
      currency_code: cart.currency_code ?? null,
      items,
      item_count: itemCount,
      total,
      updated_at: this.toIso(cart.updated_at),
      completed_at: this.toIso(cart.completed_at),
      metadata: (cart.metadata as Record<string, unknown>) ?? {},
    }
  }

  /** Uppercase alphanumeric token for building unique, human-typable codes. */
  private randomAlnum(length: number): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let out = ""
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    return out
  }

  private toCommerceCategory(category: any): CommerceCategory {
    return {
      id: category.id,
      name: category.name ?? null,
      handle: category.handle ?? null,
      description: category.description ?? null,
    }
  }

  private toCommerceOrder(order: any): CommerceOrder {
    const items: CommerceLineItem[] = (order.items ?? []).map((it: any) => ({
      title: it.title ?? "",
      quantity: Number(it.quantity ?? 0),
      variant_id: it.variant_id ?? null,
      product_id: it.product_id ?? null,
    }))

    return {
      id: order.id,
      display_id: order.display_id ?? null,
      email: order.email ?? null,
      // Prefer the shipping address phone (what a caller dials), fall back to
      // the account phone joined from the customer.
      phone: order.shipping_address?.phone ?? order.customer?.phone ?? null,
      currency_code: order.currency_code ?? null,
      total: this.toNumber(order.total),
      payment_status: order.payment_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      status: order.status ?? null,
      items,
      shipping_address: this.toCommerceAddress(order.shipping_address),
      customer_id: order.customer_id ?? null,
      created_at: this.toIso(order.created_at),
      metadata: (order.metadata as Record<string, unknown>) ?? {},
    }
  }

  private toCommerceCustomer(customer: any): CommerceCustomer {
    const addresses: CommerceAddress[] = (customer.addresses ?? [])
      .map((a: any) => this.toCommerceAddress(a))
      .filter((a: CommerceAddress | null): a is CommerceAddress => a !== null)

    return {
      id: customer.id,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      first_name: customer.first_name ?? null,
      last_name: customer.last_name ?? null,
      has_account: Boolean(customer.has_account),
      addresses,
    }
  }

  private toCommerceAddress(addr: any): CommerceAddress | null {
    if (!addr) {
      return null
    }
    const name =
      [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim() || null
    return {
      name,
      phone: addr.phone ?? null,
      address_1: addr.address_1 ?? null,
      address_2: addr.address_2 ?? null,
      city: addr.city ?? null,
      province: addr.province ?? null,
      postal_code: addr.postal_code ?? null,
      country_code: addr.country_code ?? null,
    }
  }

  /** Medusa money fields are BigNumberValue (number | string | BigNumber-like). */
  private toNumber(value: unknown): number {
    if (value == null) {
      return 0
    }
    if (typeof value === "number") {
      return value
    }
    if (typeof value === "string") {
      const n = Number(value)
      return Number.isFinite(n) ? n : 0
    }
    // BigNumber-like object exposes `numeric` / `valueOf`.
    const anyVal = value as any
    if (typeof anyVal.numeric === "number") {
      return anyVal.numeric
    }
    const n = Number(anyVal)
    return Number.isFinite(n) ? n : 0
  }

  private toIso(value: unknown): string | null {
    if (!value) {
      return null
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    return String(value)
  }
}
