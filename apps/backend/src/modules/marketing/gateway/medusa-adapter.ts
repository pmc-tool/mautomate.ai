import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow } from "@medusajs/core-flows"

import { PLATFORM_MODULE } from "../../platform"
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
  // THE tenant scoping key for orders — always fetched so every read can
  // re-verify the row it is about to hand back (defense in depth).
  "sales_channel_id",
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
  // `metadata.tenant_id` is one of the two tenant-ownership markers for a
  // customer (the other is an order in the tenant's sales channel).
  "metadata",
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

// Product categories carry no sales-channel link in Medusa; on this platform a
// category is owned by the tenant whose id is stamped in `metadata.tenant_id`
// (same rule the merchant category API enforces — see
// api/merchant/product-categories/route.ts).
const CATEGORY_FIELDS = ["id", "name", "handle", "description", "metadata"]

/**
 * Fields fetched for a cart graph (cart -> items -> item.product). `total` is the
 * cart module's computed grand total; it is preferred when present and falls back
 * to a sum of `unit_price * quantity` when the graph does not populate it.
 */
const CART_FIELDS = [
  "id",
  "email",
  // THE tenant scoping key for carts — abandoned-cart recovery emails real
  // shoppers, so every cart row is re-verified against it before it is used.
  "sales_channel_id",
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
 * TENANCY (this is a pooled, multi-tenant backend — one Node process and one
 * Medusa database serve every store):
 *   A tenant owns exactly one Medusa sales channel, `tenant.meta.sales_channel_id`.
 *   That sales channel IS the scoping key for everything below:
 *     - product  -> the product_sales_channel link
 *     - order    -> order.sales_channel_id
 *     - cart     -> cart.sales_channel_id
 *     - customer -> metadata.tenant_id, else the sales channel of any of its orders
 *     - category -> metadata.tenant_id (categories have no sales-channel link)
 *   Same rules as `lib/marketing-event-tenant.ts`, the /merchant API and the
 *   call-center gateway.
 *
 * FAIL-CLOSED: when a tenant has no resolvable sales channel EVERY read returns
 * empty/null and every write throws. A mis-provisioned or unknown tenant must
 * never fall back to a platform-wide query — that is precisely how the marketing
 * analytics, AI-prompt and abandoned-cart leaks happened.
 */
export class MedusaCommerceGateway implements CommerceGateway {
  private readonly container: MedusaContainer

  /** tenant_id -> sales_channel_id (null = unresolvable), cached per instance. */
  private readonly scIdCache = new Map<string, string | null>()

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

  private get platformService(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }

  // ---------------------------------------------------------------------------
  // Tenant scoping (fail-closed)
  // ---------------------------------------------------------------------------

  /**
   * The Medusa sales channel id for this tenant, read from the control-plane
   * tenant row's `meta.sales_channel_id`. Returns null when the tenant is
   * unknown or has no sales channel — callers MUST then fail closed (empty /
   * null / throw) so a mis-provisioned tenant can never see another store's data.
   */
  private async tenantSalesChannelId(
    tenantId: string
  ): Promise<string | null> {
    if (this.scIdCache.has(tenantId)) {
      return this.scIdCache.get(tenantId) ?? null
    }

    let scId: string | null = null
    try {
      const tenant = await this.platformService.retrieveTenant(tenantId)
      const raw = tenant?.meta?.sales_channel_id
      scId = typeof raw === "string" && raw.trim().length > 0 ? raw : null
    } catch {
      // Unknown tenant / platform error -> fail closed.
      scId = null
    }

    this.scIdCache.set(tenantId, scId)
    return scId
  }

  /**
   * The product ids linked to a sales channel, via the product_sales_channel
   * link entity. This is the ONLY way a product enters a tenant's catalog —
   * exactly what the merchant product API and the call-center gateway do.
   *
   * Paged so a large catalog is not silently truncated at one page.
   */
  private async tenantProductIds(scId: string): Promise<string[]> {
    const PAGE = 1000
    const MAX = 20000
    const ids: string[] = []

    for (let skip = 0; skip < MAX; skip += PAGE) {
      const { data: links } = await this.query.graph({
        entity: "product_sales_channel",
        fields: ["product_id"],
        filters: { sales_channel_id: scId } as any,
        pagination: { take: PAGE, skip } as any,
      })
      const rows = links ?? []
      for (const link of rows) {
        const id = (link as any)?.product_id
        if (typeof id === "string" && id.length > 0) {
          ids.push(id)
        }
      }
      if (rows.length < PAGE) {
        break
      }
    }

    return ids
  }

  /** True when `productId` is linked to the tenant's sales channel. */
  private async productInSalesChannel(
    scId: string,
    productId: string
  ): Promise<boolean> {
    const { data: links } = await this.query.graph({
      entity: "product_sales_channel",
      fields: ["product_id"],
      filters: { sales_channel_id: scId, product_id: productId } as any,
    })
    return Boolean(links?.length)
  }

  /**
   * A customer belongs to the tenant iff its own `metadata.tenant_id` says so,
   * OR it placed at least one order in the tenant's sales channel. Mirrors
   * `tenantForCustomer` in lib/marketing-event-tenant.ts.
   */
  private async customerBelongsToTenant(
    tenantId: string,
    scId: string,
    customer: any
  ): Promise<boolean> {
    const tagged = (customer?.metadata as any)?.tenant_id
    if (typeof tagged === "string" && tagged === tenantId) {
      return true
    }

    const customerId = customer?.id
    if (typeof customerId !== "string" || !customerId) {
      return false
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id", "sales_channel_id"],
      filters: { customer_id: customerId, sales_channel_id: scId } as any,
      pagination: { take: 1, skip: 0 } as any,
    })
    return (data ?? []).some((o: any) => o?.sales_channel_id === scId)
  }

  /**
   * Assert that `orderId` is an order in the tenant's sales channel, and return
   * it. Every WRITE goes through this first: a write against an out-of-tenant
   * (or non-existent) order id must fail closed, never silently succeed.
   */
  private async assertOrderInTenant(
    tenantId: string,
    orderId: string
  ): Promise<{ id: string; metadata: Record<string, unknown> }> {
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order ${orderId} is not accessible: tenant ${tenantId} has no sales channel`
      )
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id", "sales_channel_id", "metadata"],
      filters: { id: orderId, sales_channel_id: scId } as any,
    })

    const order = data?.[0]
    if (!order || order.sales_channel_id !== scId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order ${orderId} was not found in tenant ${tenantId}`
      )
    }

    return {
      id: order.id,
      metadata: (order.metadata as Record<string, unknown>) ?? {},
    }
  }

  // ---------------------------------------------------------------------------
  // Catalog reads (marketing surface)
  // ---------------------------------------------------------------------------

  async getProduct(
    tenantId: string,
    id: string
  ): Promise<CommerceProduct | null> {
    // TENANT SCOPE: the product must be linked to the tenant's sales channel
    // (product_sales_channel). Fail-closed: no sales channel -> null.
    //
    // NOTE ON STATUS: no status filter is applied — a tenant may legitimately
    // read its OWN draft product (the product.created subscriber and the studio
    // image/video generators do exactly that, and a freshly created product is
    // a draft). What this used to allow, and no longer does, is reading ANOTHER
    // store's product — draft or published — which is how foreign (including
    // unpublished) products were being injected into a merchant's AI prompt.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    if (!(await this.productInSalesChannel(scId, id))) {
      return null
    }

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
    // TENANT SCOPE: only products linked to the tenant's sales channel are ever
    // considered. Fail-closed: no sales channel (or an empty catalog) -> [].
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    const productIds = await this.tenantProductIds(scId)
    if (!productIds.length) {
      return []
    }

    const filters: Record<string, unknown> = { id: productIds }

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

    const { data } = await this.query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters,
      pagination: {
        skip: filter.offset ?? 0,
        take: filter.limit ?? 50,
      },
    })

    // Defense in depth: re-verify every returned row against the tenant's
    // catalog before it leaves this class.
    const allowed = new Set(productIds)
    return (data ?? [])
      .filter((p: any) => allowed.has(p?.id))
      .map((p: any) => this.toCommerceProduct(p))
  }

  async getCategory(
    tenantId: string,
    id: string
  ): Promise<CommerceCategory | null> {
    // TENANT SCOPE: categories have no sales-channel link in Medusa; on this
    // platform they are owned via `metadata.tenant_id` (the rule the merchant
    // category API enforces). Fail-closed: no sales channel -> null, and an
    // untagged / foreign-tagged category is invisible.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    const { data } = await this.query.graph({
      entity: "product_category",
      fields: CATEGORY_FIELDS,
      filters: { id },
    })

    const category = data?.[0]
    if (!category) {
      return null
    }

    const owner = (category.metadata as any)?.tenant_id
    if (typeof owner !== "string" || owner !== tenantId) {
      return null
    }

    return this.toCommerceCategory(category)
  }

  // ---------------------------------------------------------------------------
  // Order + customer reads
  // ---------------------------------------------------------------------------

  async getOrder(
    tenantId: string,
    orderId: string
  ): Promise<CommerceOrder | null> {
    // TENANT SCOPE: an order is in-tenant iff its sales_channel_id equals the
    // tenant's sales channel. Fail-closed: no sales channel -> null.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: orderId, sales_channel_id: scId } as any,
    })

    const order = data?.[0]
    // Defense in depth: re-verify the row's sales channel before returning it.
    if (!order || order.sales_channel_id !== scId) {
      return null
    }
    return this.toCommerceOrder(order)
  }

  async queryOrders(
    tenantId: string,
    filter: OrderFilter
  ): Promise<CommerceOrder[]> {
    // TENANT SCOPE: constrain every order read to the tenant's sales channel.
    // Fail-closed: no sales channel -> []. (Before this, marketing analytics
    // summed the WHOLE platform's orders and revenue for every merchant.)
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    const filters: Record<string, unknown> = { sales_channel_id: scId }

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

    let orders = (data ?? [])
      // Defense in depth: re-verify the sales channel on every returned row.
      .filter((o: any) => o?.sales_channel_id === scId)
      .map((o: any) => this.toCommerceOrder(o))

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
    // TENANT SCOPE: customers have no sales_channel_id column, so a customer is
    // in-tenant iff `metadata.tenant_id` matches OR it has an order in the
    // tenant's sales channel (the rule in lib/marketing-event-tenant.ts).
    // Fail-closed: no sales channel -> null.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    const { data } = await this.query.graph({
      entity: "customer",
      fields: CUSTOMER_FIELDS,
      filters: { id: customerId },
    })

    const customer = data?.[0]
    if (!customer) {
      return null
    }

    if (!(await this.customerBelongsToTenant(tenantId, scId, customer))) {
      return null
    }

    return this.toCommerceCustomer(customer)
  }

  async findCustomersByPhone(
    tenantId: string,
    phoneE164: string
  ): Promise<CommerceCustomer[]> {
    // TENANT SCOPE: registered matches are kept only when the customer belongs
    // to the tenant, and the guest scan below runs over the tenant's ORDERS
    // ONLY (sales-channel filtered). Without this, the same phone number in two
    // stores bound the caller to the WRONG person's record.
    // Fail-closed: no sales channel -> [].
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    // 1. Registered customers whose account phone matches AND who belong to
    //    this tenant.
    const { data: customerRows } = await this.query.graph({
      entity: "customer",
      fields: CUSTOMER_FIELDS,
      filters: { phone: phoneE164 },
    })

    const results: CommerceCustomer[] = []
    for (const row of customerRows ?? []) {
      if (await this.customerBelongsToTenant(tenantId, scId, row)) {
        results.push(this.toCommerceCustomer(row))
      }
    }
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
        "sales_channel_id",
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
      filters: { sales_channel_id: scId } as any,
      pagination: { take: 500, order: { created_at: "DESC" } },
    })

    for (const order of orderRows ?? []) {
      // Defense in depth: never consider an out-of-tenant order.
      if (order?.sales_channel_id !== scId) {
        continue
      }
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
    // TENANT SCOPE: throws MedusaError.NOT_FOUND when the order is not in the
    // tenant's sales channel (or the tenant has none) — a write against an
    // out-of-tenant id must fail closed, never silently succeed.
    const { metadata: current } = await this.assertOrderInTenant(
      tenantId,
      orderId
    )
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
    // TENANT SCOPE: refuse to cancel an order outside the tenant's sales
    // channel (throws MedusaError.NOT_FOUND). Checked explicitly here — and
    // again inside updateOrderMetadata — so no path reaches `cancel()` unchecked.
    await this.assertOrderInTenant(tenantId, orderId)

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
    //
    // TENANT SCOPE: enforced by updateOrderMetadata (throws NOT_FOUND for an
    // out-of-tenant order), asserted here too so the intent is explicit.
    await this.assertOrderInTenant(tenantId, orderId)
    await this.updateOrderMetadata(tenantId, orderId, {
      [FULFILLMENT_HOLD_KEY]: held,
    })
  }

  async isFulfillmentHeld(tenantId: string, orderId: string): Promise<boolean> {
    // Reads never throw — an out-of-tenant (or unknown) order is simply "not
    // held" as far as this tenant is concerned.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return false
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id", "sales_channel_id", "metadata"],
      filters: { id: orderId, sales_channel_id: scId } as any,
    })

    const order = data?.[0]
    if (!order || order.sales_channel_id !== scId) {
      return false
    }

    const metadata = (order.metadata as Record<string, unknown>) ?? {}
    return metadata[FULFILLMENT_HOLD_KEY] === true
  }

  // ---------------------------------------------------------------------------
  // Cart reads + recovery (abandoned-cart recovery)
  // ---------------------------------------------------------------------------

  async getCart(
    tenantId: string,
    cartId: string
  ): Promise<CommerceCart | null> {
    // TENANT SCOPE: a cart is in-tenant iff its sales_channel_id equals the
    // tenant's sales channel. Fail-closed: no sales channel -> null.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    try {
      const { data } = await this.query.graph({
        entity: "cart",
        fields: CART_FIELDS,
        filters: { id: cartId, sales_channel_id: scId } as any,
      })

      const cart = data?.[0]
      // Defense in depth: re-verify the row's sales channel.
      if (!cart || cart.sales_channel_id !== scId) {
        return null
      }
      return this.toCommerceCart(cart)
    } catch {
      // Reads never throw for "not found"/backend failure — surface null.
      return null
    }
  }

  async listAbandonedCarts(
    tenantId: string,
    filter: AbandonedCartFilter
  ): Promise<CommerceCart[]> {
    // TENANT SCOPE: THE most dangerous read in this file — its output is what
    // cart-recovery EMAILS. Every cart must be in the tenant's sales channel:
    // filtered in the query, re-checked in the in-memory pass below, and in the
    // module-service fallback. Fail-closed: no sales channel -> [].
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

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
          sales_channel_id: scId,
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
      // The tenant scope is NOT relaxed here.
      try {
        rows = await this.cartService.listCarts(
          { completed_at: null, sales_channel_id: scId },
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
        // TENANT SCOPE (re-check): a cart that is not in this tenant's sales
        // channel can NEVER be recovered/emailed by this tenant, whichever path
        // (graph or module-service fallback) produced the row.
        if (c.sales_channel_id !== scId) {
          return false
        }
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
    // TENANT SCOPE: the promotion is created with a rule that pins it to the
    // tenant's sales channel, so a recovery code minted for store A can only be
    // redeemed in store A's storefront (the promotion rule context is the cart,
    // which carries `sales_channel_id`). Fail-closed: no sales channel -> null,
    // i.e. no code is minted rather than a platform-wide one.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

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
              // TENANT SCOPE: only redeemable in this tenant's sales channel.
              rules: [
                {
                  attribute: "sales_channel_id",
                  operator: "eq",
                  values: [scId],
                },
              ],
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
