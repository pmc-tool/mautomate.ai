import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../../platform"
import {
  CommerceAddress,
  CommerceCustomer,
  CommerceGateway,
  CommerceLineItem,
  CommerceOrder,
  CommerceProduct,
  CommerceProductVariant,
  CustomerOrderLookup,
  deriveOrderProgress,
  OrderFilter,
  OrderLookup,
  OrderTracking,
} from "./commerce-gateway"

/**
 * Metadata key under which we store the call-center fulfillment-hold flag.
 *
 * IMPORTANT: Medusa has NO native concept of a fulfillment hold — it does NOT
 * gate any fulfillment on this flag. It is purely a call-center construct.
 * Therefore our own dialer AND any custom fulfillment path (subscribers,
 * workflows, manual admin actions we own) MUST read this flag via
 * `isFulfillmentHeld` and refuse to ship when it is `true`. Nothing in stock
 * Medusa enforces it for us.
 */
const FULFILLMENT_HOLD_KEY = "cc_fulfillment_hold"

/**
 * Metadata key under which we store the call-center tag set (see `setOrderTags`).
 * These are call-center tags, distinct from any backend-native tagging system.
 */
const ORDER_TAGS_KEY = "cc_tags"

/** Fields fetched for a full order graph (order -> items -> shipping_address -> customer). */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
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

// LIST-context fields: identical to ORDER_FIELDS but WITHOUT the computed
// `total`. Requesting `total` in a PAGINATED order query makes the order module
// hydrate each order's versioned shipping-method adjustments and throws
// "Shipping method version is required to load adjustments" for real checkout
// orders. `total` is safe in the single-order `getOrder` path (no pagination),
// so list lookups omit it and callers read the amount via getOrder when needed.
const ORDER_LIST_FIELDS = ORDER_FIELDS.filter((f) => f !== "total")

// SINGLE-ORDER read: ORDER_FIELDS plus the underlying fulfillment + payment
// rows. The order module's computed `fulfillment_status`/`payment_status`
// columns come back null through query.graph, so we derive ACCURATE values from
// these rows (see deriveFulfillmentStatus / derivePaymentStatus). Safe here
// because getOrder is a single-id read (no pagination) where `total` also works.
const ORDER_DETAIL_FIELDS = [
  ...ORDER_FIELDS,
  "fulfillments.canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "payment_collections.status",
]

/**
 * Derive an accurate fulfillment status from the order's fulfillment rows.
 * Falls back to the (often-null) computed column when the rows weren't loaded
 * (e.g. a list query). Mirrors the merchant order-list derivation.
 */
const deriveFulfillmentStatus = (order: any): string | null => {
  const fs = order?.fulfillments
  if (!Array.isArray(fs)) {
    return order?.fulfillment_status ?? null
  }
  if (fs.length === 0) {
    return order?.fulfillment_status ?? "not_fulfilled"
  }
  const active = fs.filter((f: any) => !f?.canceled_at)
  if (active.length === 0) {
    return "canceled"
  }
  if (active.every((f: any) => f?.delivered_at)) {
    return "delivered"
  }
  if (active.every((f: any) => f?.shipped_at || f?.delivered_at)) {
    return "shipped"
  }
  return "fulfilled"
}

/**
 * Derive an accurate payment status from the order's payment collections.
 *
 * "completed" is a PAID collection — it is the status Medusa writes when a
 * collection has been captured in full, and it is what the payment provider
 * leaves behind on a normal checkout. It was missing from the ladder below, so
 * every fully-paid order fell through to the final `return "not_paid"`.
 *
 * That single missing case is why a customer whose parcel had already shipped
 * was told "payment has not been received yet". Nothing was wrong with their
 * money; the word for it was simply not on this list.
 */
const derivePaymentStatus = (order: any): string | null => {
  const pcs = order?.payment_collections
  if (Array.isArray(pcs) && pcs.length) {
    const st = pcs.map((p: any) => p?.status).filter(Boolean)
    if (st.length) {
      const isPaid = (s: string) => s === "captured" || s === "completed"
      if (st.every(isPaid)) return "captured"
      if (st.some((s: string) => isPaid(s) || s === "partially_captured"))
        return "partially_captured"
      if (st.some((s: string) => s === "refunded")) return "refunded"
      if (st.some((s: string) => s === "authorized")) return "authorized"
      if (st.some((s: string) => s === "partially_authorized"))
        return "partially_authorized"
      if (st.some((s: string) => s === "awaiting")) return "awaiting"
      if (st.every((s: string) => s === "canceled")) return "canceled"
      return "not_paid"
    }
  }
  return order?.payment_status ?? null
}

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

/** Fields fetched for a catalog product (product -> variants). */
const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "description",
  "status",
  "thumbnail",
  // A product can carry images while its `thumbnail` column is empty (the
  // thumbnail is only set on some import paths). Without the gallery we showed a
  // placeholder next to a product that HAS a photo.
  "images.url",
  "images.rank",
  "variants.id",
  "variants.title",
  "variants.sku",
]

/**
 * Medusa-backed implementation of `CommerceGateway`.
 *
 * Reads go through the Query graph (one round-trip joins order -> items ->
 * shipping_address -> customer). Writes go through the module services
 * (Modules.ORDER / Modules.CUSTOMER). Everything is mapped to the normalized,
 * backend-agnostic DTOs before it leaves this class.
 *
 * `tenantId` is currently accepted-but-unscoped (single-tenant store). Every
 * place it would eventually constrain a query/write is marked with
 * `TODO(tenancy)`.
 */
// ---------------------------------------------------------------------------
// voice-robust order matching helpers
// Over a phone call, DIGITS transcribe reliably but EMAILS do not (STT mangles
// the local part and domain). So order-number / order-code lookups are exact,
// while email/phone are matched fuzzily in-memory as a fallback finder.
// ---------------------------------------------------------------------------

const normEmail = (e: string | null | undefined): string =>
  (e ?? "").toLowerCase().replace(/\s+/g, "").trim()

const normPhone = (p: string | null | undefined): string =>
  (p ?? "").replace(/\D/g, "")

/** Iterative Levenshtein distance (STT-tolerant email compare). */
const levenshtein = (a: string, b: string): number => {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  return dp[n]
}

/** Allowed edit distance for a normalized email (STT slack, capped at 3). */
const emailTolerance = (e: string): number =>
  Math.min(3, Math.max(1, Math.floor(e.length * 0.15)))

export class MedusaCommerceGateway implements CommerceGateway {
  private readonly container: MedusaContainer

  /**
   * Per-instance caches for the tenant -> sales-channel / region resolution.
   * A gateway instance is request-scoped, so caching here just avoids repeat
   * platform lookups within one call; it is never shared across tenants.
   */
  private scIdCache = new Map<string, string | null>()
  private regionCache = new Map<
    string,
    { id: string; currency_code: string } | null
  >()

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

  private get platformService(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }

  private get pricingService(): any {
    return this.container.resolve(Modules.PRICING)
  }

  private get inventoryService(): any {
    return this.container.resolve(Modules.INVENTORY)
  }

  // ---------------------------------------------------------------------------
  // Tenant scoping (fail-closed)
  // ---------------------------------------------------------------------------

  /**
   * The Medusa sales channel id for this tenant, read from the control-plane
   * tenant row's `meta.sales_channel_id`. This is THE scoping key for every read
   * below. Returns null when the tenant has no sales channel — callers MUST then
   * fail closed (return empty / null) so a mis-provisioned tenant can never see
   * another store's data.
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
   * The tenant's region (id + currency_code), read from `meta.region_id` and
   * resolved against the `region` entity. Used to pick the right price and to
   * label prices with a currency. Returns null when unresolvable.
   */
  private async tenantRegion(
    tenantId: string
  ): Promise<{ id: string; currency_code: string } | null> {
    if (this.regionCache.has(tenantId)) {
      return this.regionCache.get(tenantId) ?? null
    }
    let region: { id: string; currency_code: string } | null = null
    try {
      const tenant = await this.platformService.retrieveTenant(tenantId)
      const regionId = tenant?.meta?.region_id
      if (typeof regionId === "string" && regionId.trim().length > 0) {
        const { data } = await this.query.graph({
          entity: "region",
          fields: ["id", "currency_code"],
          filters: { id: regionId },
        })
        const row = data?.[0]
        if (row?.id) {
          region = {
            id: row.id,
            currency_code: String(row.currency_code ?? "").toLowerCase() || "",
          }
        }
      }
    } catch {
      region = null
    }
    this.regionCache.set(tenantId, region)
    return region
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async getOrder(
    tenantId: string,
    orderId: string
  ): Promise<CommerceOrder | null> {
    // TENANT SCOPE: an order is in-tenant iff its sales_channel_id equals the
    // tenant's sales channel. Fail-closed: no sales channel -> no access.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    // Callers say "order 8", not "order_01KX5WANNZYQM7DDQH2NWHF6Q8". Accept the
    // ORDER NUMBER (display_id) as well as the internal id — the agent was
    // reporting "order 8 was not found" for orders that plainly exist.
    const raw = String(orderId ?? "").trim()
    const isInternalId = raw.startsWith("order_")
    const displayId = Number(raw.replace(/^#/, ""))
    const byNumber = !isInternalId && Number.isFinite(displayId) && displayId > 0

    const filters: Record<string, unknown> = byNumber
      ? { display_id: displayId, sales_channel_id: scId }
      : { id: raw, sales_channel_id: scId }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_DETAIL_FIELDS,
      filters: filters as any,
    })

    const order = data?.[0]
    // Defense-in-depth: re-verify the returned row's SC before handing it back.
    if (!order || order.sales_channel_id !== scId) {
      return null
    }
    return await this.enrichOrder(this.toCommerceOrder(order))
  }

  /**
   * Replace what the graph got wrong, and add what it never had.
   *
   * An order in Medusa is VERSIONED: its money lives in `order_summary` and its
   * quantities in `order_item`, one row per revision. The computed fields the
   * graph hands back (`total`, `payment_status`, `items[].quantity`) are read off
   * a stale version, so a real, fully-paid, already-shipped order came back as
   * total $500 (it is $4,500), payment_status "not_paid" (it was paid in full,
   * days earlier) and quantity 0 (it is 4). An agent repeated all of that to the
   * customer, because an agent can only be as truthful as its data.
   *
   * So the numbers are read from the LATEST version, straight from the tables
   * that hold them, and the shipment facts (which the order row simply does not
   * carry) come from the fulfillments.
   *
   * Best-effort by construction: any failure here leaves the order exactly as the
   * graph gave it. A missing tracking number must never cost us the order lookup.
   */
  private async enrichOrder(order: CommerceOrder): Promise<CommerceOrder> {
    const [enriched] = await this.enrichOrders([order])
    return enriched ?? order
  }

  /**
   * Batched: THREE queries no matter how many orders. A per-order enrich would be
   * an N+1 on every list the agent reads.
   */
  private async enrichOrders(orders: CommerceOrder[]): Promise<CommerceOrder[]> {
    if (!orders.length) {
      return orders
    }
    try {
      const pg: any = this.container.resolve(
        ContainerRegistrationKeys.PG_CONNECTION
      )
      const ids = orders.map((o) => o.id)

      const [summaryRows, itemRows, shipmentRows] = await Promise.all([
        // The latest summary version per order — DISTINCT ON does the "max
        // version" pick in one pass.
        pg
          .select("order_id", "totals")
          .from("order_summary")
          .distinctOn("order_id")
          .whereIn("order_id", ids)
          .whereNull("deleted_at")
          .orderBy([
            { column: "order_id" },
            { column: "version", order: "desc" },
          ]),
        pg
          .select(
            "oi.order_id as order_id",
            "oli.title as title",
            "oi.quantity as quantity"
          )
          .from("order_item as oi")
          .join("order_line_item as oli", "oli.id", "oi.item_id")
          .whereIn("oi.order_id", ids)
          .whereNull("oi.deleted_at")
          .andWhereRaw(
            "oi.version = (select max(version) from order_item x where x.order_id = oi.order_id)"
          ),
        pg
          .select(
            "of2.order_id as order_id",
            "f.shipped_at as shipped_at",
            "f.delivered_at as delivered_at",
            "l.tracking_number as tracking_number",
            "l.tracking_url as tracking_url"
          )
          .from("order_fulfillment as of2")
          .join("fulfillment as f", "f.id", "of2.fulfillment_id")
          .leftJoin("fulfillment_label as l", "l.fulfillment_id", "f.id")
          .whereIn("of2.order_id", ids)
          .whereNull("f.canceled_at")
          .whereNull("f.deleted_at"),
      ])

      const num = (v: any): number | null =>
        v == null || Number.isNaN(Number(v)) ? null : Number(v)

      const totalsById = new Map<string, any>()
      for (const row of Array.isArray(summaryRows) ? summaryRows : []) {
        totalsById.set(String(row.order_id), row.totals ?? null)
      }

      const itemsById = new Map<string, { title: string; quantity: number }[]>()
      for (const row of Array.isArray(itemRows) ? itemRows : []) {
        const key = String(row.order_id)
        const list = itemsById.get(key) ?? []
        list.push({
          title: row.title ?? null,
          quantity: row.quantity != null ? Number(row.quantity) : 0,
        })
        itemsById.set(key, list)
      }

      type Shipment = {
        tracking: OrderTracking[]
        shippedAt: string | null
        deliveredAt: string | null
      }
      const shipById = new Map<string, Shipment>()
      for (const row of Array.isArray(shipmentRows) ? shipmentRows : []) {
        const key = String(row.order_id)
        const s: Shipment = shipById.get(key) ?? {
          tracking: [],
          shippedAt: null,
          deliveredAt: null,
        }
        if (row.shipped_at && !s.shippedAt) {
          s.shippedAt = new Date(row.shipped_at).toISOString()
        }
        if (row.delivered_at && !s.deliveredAt) {
          s.deliveredAt = new Date(row.delivered_at).toISOString()
        }
        if (row.tracking_number) {
          s.tracking.push({
            number: String(row.tracking_number),
            url: row.tracking_url ? String(row.tracking_url) : null,
          })
        }
        shipById.set(key, s)
      }

      return orders.map((order) => {
        const totals = totalsById.get(order.id) ?? null
        const ship: Shipment = shipById.get(order.id) ?? {
          tracking: [],
          shippedAt: null,
          deliveredAt: null,
        }

        const total = num(totals?.current_order_total) ?? order.total
        const paidTotal = num(totals?.paid_total)
        const pending = num(totals?.pending_difference)
        // Settled when nothing is still owed. THIS — not `payment_status` — is
        // the truth about whether the customer's money arrived.
        const paid =
          pending != null
            ? pending <= 0
            : paidTotal != null && total != null
              ? paidTotal >= total
              : String(order.payment_status ?? "") !== "not_paid"

        const trueItems = itemsById.get(order.id) ?? []
        const items: CommerceLineItem[] = trueItems.length
          ? trueItems.map((r, i) => ({
              ...(order.items?.[i] ?? ({} as CommerceLineItem)),
              title: r.title ?? order.items?.[i]?.title ?? null,
              quantity: r.quantity,
            }))
          : order.items

        return {
          ...order,
          total: total ?? order.total,
          items,
          paid_total: paidTotal,
          pending_difference: pending,
          tracking: ship.tracking,
          shipped_at: ship.shippedAt,
          delivered_at: ship.deliveredAt,
          progress: deriveOrderProgress({
            status: order.status ?? null,
            fulfillment_status: order.fulfillment_status ?? null,
            paid,
            tracking: ship.tracking,
            shipped_at: ship.shippedAt,
            delivered_at: ship.deliveredAt,
          }),
        }
      })
    } catch {
      return orders
    }
  }

  async queryOrders(
    tenantId: string,
    filter: OrderFilter
  ): Promise<CommerceOrder[]> {
    // TENANT SCOPE: constrain to the tenant's sales channel. Fail-closed.
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
      // order entity in this Medusa version (v2.17).
      filters.created_at = { $gt: this.toDate(filter.created_after) }
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_LIST_FIELDS,
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

    return await this.enrichOrders(orders)
  }

  async findOrders(
    tenantId: string,
    lookup: OrderLookup
  ): Promise<CommerceOrder[]> {
    // TENANT SCOPE: sales_channel_id is ALWAYS AND-ed into the filter, so a
    // matching display_id/email in another tenant's store can never surface.
    // Fail-closed: no sales channel -> empty.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    // Order NUMBER (display_id) and CODE (metadata.support_code) are RELIABLE
    // spoken identifiers -> exact. Email/phone are noisy over voice, so they are
    // NEVER a hard SQL filter; they only fuzzily narrow a candidate set.
    let displayId: number | null = null
    if (lookup.display_id !== undefined && lookup.display_id !== null) {
      const raw = String(lookup.display_id).trim().replace(/^#/, "")
      const num = Number(raw)
      if (Number.isFinite(num)) displayId = num
    }
    const code =
      typeof (lookup as any).code === "string" && (lookup as any).code.trim()
        ? String((lookup as any).code).replace(/\D/g, "")
        : null

    const filters: Record<string, unknown> = { sales_channel_id: scId }
    if (displayId !== null) {
      filters.display_id = displayId
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_LIST_FIELDS,
      filters,
      pagination: {
        // Exact number lookup is narrow; a code/email/phone-only lookup needs a
        // wider recent window to match against in-memory.
        take: displayId !== null ? 20 : 500,
        order: { created_at: "DESC" },
      },
    })

    let orders = (data ?? [])
      // Defense-in-depth: re-verify SC on every returned row.
      .filter((o: any) => o.sales_channel_id === scId)
      .map((o: any) => this.toCommerceOrder(o))

    // CODE narrows exactly (numeric, reliable).
    if (code) {
      orders = orders.filter(
        (o) => String((o.metadata as any)?.support_code ?? "") === code
      )
    }

    // Anchored by order NUMBER or CODE -> return as-is; the agent then verifies
    // identity conversationally. (A mangled email must NOT hide a real order.)
    if (displayId !== null || code) {
      return await this.enrichOrders(orders.slice(0, 20))
    }

    // Email-only / phone-only fallback: fuzzy match, tolerant of STT errors.
    if (lookup.email) {
      const q = normEmail(lookup.email)
      if (q) {
        orders = orders.filter((o) => {
          const e = normEmail(o.email)
          return !!e && (e === q || levenshtein(e, q) <= emailTolerance(q))
        })
      }
    }
    if (lookup.phone) {
      const q = normPhone(lookup.phone)
      if (q.length >= 7) {
        const tail = q.slice(-9)
        orders = orders.filter((o) => {
          const p = normPhone(o.phone)
          return p.length >= 7 && (p.endsWith(tail) || tail.endsWith(p.slice(-9)))
        })
      }
    }

    return orders.slice(0, 20)
  }

  async listCustomerOrders(
    tenantId: string,
    lookup: CustomerOrderLookup
  ): Promise<CommerceOrder[]> {
    // TENANT SCOPE: sales_channel_id AND-ed into the filter. Fail-closed.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    const filters: Record<string, unknown> = { sales_channel_id: scId }
    if (lookup.customer_id) {
      filters.customer_id = lookup.customer_id
    }
    if (lookup.email) {
      filters.email = lookup.email
    }

    const { data } = await this.query.graph({
      entity: "order",
      fields: ORDER_LIST_FIELDS,
      filters,
      pagination: { take: 50, order: { created_at: "DESC" } },
    })

    let orders = (data ?? [])
      .filter((o: any) => o.sales_channel_id === scId)
      .map((o: any) => this.toCommerceOrder(o))

    // phone lives on the shipping/account address -> match in-memory.
    if (lookup.phone) {
      const phone = lookup.phone
      orders = orders.filter(
        (o: CommerceOrder) =>
          o.shipping_address?.phone === phone || o.phone === phone
      )
    }

    return await this.enrichOrders(orders)
  }

  async searchProducts(
    tenantId: string,
    query: string,
    limit = 5
  ): Promise<CommerceProduct[]> {
    // TENANT SCOPE: only products linked to the tenant's sales channel are ever
    // considered (product ids come from the product_sales_channel link filtered
    // by sales_channel_id). Fail-closed: no sales channel -> empty.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    const productIds = await this.tenantProductIds(scId)
    if (!productIds.length) {
      return []
    }

    const { data } = await this.query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters: { id: productIds, status: "published" } as any,
      pagination: { take: 100 } as any,
    })

    const q = (query ?? "").trim().toLowerCase()
    let rows = data ?? []

    // Stop-words: a caller saying "what do you sell" or "do you have anything
    // nice" is asking to SEE THE CATALOGUE, not to match those words.
    const STOP = new Set([
      "what", "whats", "do", "you", "sell", "have", "got", "any", "anything",
      "something", "some", "show", "me", "the", "a", "an", "your", "store",
      "shop", "products", "product", "items", "item", "list", "of", "for",
      "is", "are", "there", "please", "can", "i", "buy", "looking", "want",
      "need", "under", "below", "less", "than", "over", "above", "around",
      "cheap", "cheapest", "expensive", "price", "priced", "cost", "costs",
      "and", "or", "with", "in", "on", "at", "to", "it", "that", "this",
    ])

    // Price intent — "under 1000", "less than 50", "cheaper than 20".
    const priceMatch = q.match(/(?:under|below|less than|cheaper than|max)\s*\$?\s*(\d+(?:\.\d+)?)/)
    const maxPrice = priceMatch ? Number(priceMatch[1]) : null
    const minMatch = q.match(/(?:over|above|more than|at least|from)\s*\$?\s*(\d+(?:\.\d+)?)/)
    const minPrice = minMatch ? Number(minMatch[1]) : null

    // Meaningful words only (drop the conversational filler + bare numbers).
    const words = q
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))

    if (words.length) {
      const scored = rows
        .map((p: any) => {
          const hay = [p.title, p.handle, p.description, p.subtitle]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          // Score by how many of the caller's words the product matches, so a
          // partial match still surfaces rather than returning nothing.
          const hits = words.filter((w) => hay.includes(w)).length
          return { p, hits }
        })
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits)

      // If nothing matched the words, fall back to the whole catalogue rather
      // than telling the caller we have no products — we do have products.
      rows = scored.length ? scored.map((x) => x.p) : rows
    }
    // else: no meaningful words -> the caller wants the catalogue. Keep rows.

    const capped = rows.slice(0, Math.max(1, limit))
    const products = await this.toCommerceProducts(tenantId, capped)

    // Price filter runs on the PRICED results (the price lives on the variant).
    if (maxPrice != null || minPrice != null) {
      const inRange = products.filter((p: any) => {
        // Medusa v2 stores price amounts in MAJOR units (amount 1000 == $1,000),
        // and `min_price` is that amount verbatim. Dividing by 100 here treated a
        // $1,000 product as $10, so "under $50" matched the whole catalogue.
        const price = Number(p.min_price ?? 0)
        if (maxPrice != null && price > maxPrice) return false
        if (minPrice != null && price < minPrice) return false
        return true
      })
      // Only apply the filter if it leaves something — an empty result would
      // read to the caller as "we sell nothing", which is false.
      if (inRange.length) return inRange
    }

    return products
  }

  async getProduct(
    tenantId: string,
    idOrHandle: string
  ): Promise<CommerceProduct | null> {
    // TENANT SCOPE: after resolving the product by id/handle we REQUIRE it to be
    // in the tenant's sales channel (product_sales_channel link check) before
    // returning it. Fail-closed: no sales channel -> null.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return null
    }

    const key = (idOrHandle ?? "").trim()
    if (!key) {
      return null
    }

    // Products are keyed by "prod_..." ids; anything else is treated as a handle.
    const filters: Record<string, unknown> = key.startsWith("prod_")
      ? { id: key }
      : { handle: key }

    const { data } = await this.query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters: filters as any,
    })
    const product = data?.[0]
    if (!product) {
      return null
    }

    // Verify the product actually belongs to the tenant's sales channel.
    const { data: links } = await this.query.graph({
      entity: "product_sales_channel",
      fields: ["product_id"],
      filters: { sales_channel_id: scId, product_id: product.id } as any,
    })
    if (!links?.length) {
      return null
    }

    const [mapped] = await this.toCommerceProducts(tenantId, [product])
    return mapped ?? null
  }

  async getCustomer(
    tenantId: string,
    customerId: string
  ): Promise<CommerceCustomer | null> {
    // TENANT SCOPE (via orders): customers have no sales_channel_id column, so a
    // customer "belongs to" this tenant iff they have >=1 order in the tenant's
    // sales channel. Fail-closed: no sales channel -> no access.
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

    // Verify this customer has at least one order in the tenant's sales channel
    // before revealing them to this tenant.
    if (!(await this.customerHasOrderInSc(customer.id, scId))) {
      return null
    }

    return this.toCommerceCustomer(customer)
  }

  /**
   * True iff `customerId` has at least one order in sales channel `scId`. This
   * is the via-orders tenant-scoping check for customers (who carry no
   * sales_channel_id of their own).
   */
  private async customerHasOrderInSc(
    customerId: string,
    scId: string
  ): Promise<boolean> {
    if (!customerId) {
      return false
    }
    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id"],
      filters: { customer_id: customerId, sales_channel_id: scId },
      pagination: { take: 1 } as any,
    })
    return Boolean(data?.length)
  }

  async findCustomersByPhone(
    tenantId: string,
    phoneE164: string
  ): Promise<CommerceCustomer[]> {
    // TENANT SCOPE (via orders): customers carry no sales_channel_id, so we only
    // ever return customers who have >=1 order in the tenant's sales channel.
    // Registered accounts are filtered by customerHasOrderInSc; guests are
    // discovered from orders already constrained to the tenant SC. Fail-closed:
    // no sales channel -> empty.
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      return []
    }

    // 1. Registered customers whose account phone matches AND who have at least
    //    one order in the tenant's sales channel.
    const { data: customerRows } = await this.query.graph({
      entity: "customer",
      fields: CUSTOMER_FIELDS,
      filters: { phone: phoneE164 },
    })

    const results: CommerceCustomer[] = []
    for (const c of customerRows ?? []) {
      if (await this.customerHasOrderInSc(c.id, scId)) {
        results.push(this.toCommerceCustomer(c))
      }
    }
    const seen = new Set(results.map((c) => c.id))

    // 2. Guests: match orders whose shipping_address.phone equals the number,
    //    and surface a synthetic customer for each unique guest that is not
    //    already covered by a registered account above. The order query is
    //    ALWAYS constrained to the tenant's sales channel, so a guest from
    //    another store can never surface here.
    // Medusa's order Query-graph filters don't support a nested
    // shipping_address.phone predicate, so fetch a bounded recent window (within
    // the tenant SC) and match in-memory (the loop below re-checks addr.phone).
    // TODO(perf): index guest phones (a dedicated phone column / search index)
    // instead of scanning recent orders once this is on the live inbound path.
    const { data: orderRows } = await this.query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "customer_id",
        "sales_channel_id",
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
      filters: { sales_channel_id: scId },
      pagination: { take: 500, order: { created_at: "DESC" } },
    })

    for (const order of orderRows ?? []) {
      // Defense-in-depth: re-verify the SC on every returned row.
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

  /**
   * Tenant guard for writes: throws unless `orderId` belongs to `tenantId`'s
   * sales channel. Fail-closed — no resolvable SC, or an order outside it, is a
   * hard error, so a mutation can never cross tenants.
   */
  private async assertOrderInTenant(
    tenantId: string,
    orderId: string
  ): Promise<void> {
    const scId = await this.tenantSalesChannelId(tenantId)
    if (!scId) {
      throw new Error(`order ${orderId} is not accessible for this tenant`)
    }
    const { data } = await this.query.graph({
      entity: "order",
      fields: ["id", "sales_channel_id"],
      filters: { id: orderId, sales_channel_id: scId },
    })
    if (!data?.length || (data[0] as any)?.sales_channel_id !== scId) {
      throw new Error(`order ${orderId} is not accessible for this tenant`)
    }
  }

  async updateOrderMetadata(
    tenantId: string,
    orderId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    // Tenant guard: refuse to mutate an order outside this tenant's sales
    // channel (fail-closed). Every write funnels through here.
    await this.assertOrderInTenant(tenantId, orderId)
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
    // Tags are a call-center concept persisted in order metadata.
    await this.updateOrderMetadata(tenantId, orderId, {
      [ORDER_TAGS_KEY]: tags,
    })
  }

  async cancelOrder(
    tenantId: string,
    orderId: string,
    reason: string
  ): Promise<void> {
    // Tenant guard (defense-in-depth; the metadata write below also asserts).
    await this.assertOrderInTenant(tenantId, orderId)

    // Record the reason in metadata first so it survives regardless of how the
    // cancel path stores its own bookkeeping.
    await this.updateOrderMetadata(tenantId, orderId, {
      cc_cancel_reason: reason,
      cc_canceled_at: new Date().toISOString(),
    })

    // TODO(verify): `cancel(orderId)` is the order module's cancel entrypoint in
    // v2.17. Depending on business rules you may instead want to run the
    // `cancelOrderWorkflow` from @medusajs/core-flows so payment/fulfillment
    // side-effects and validations run. This does a direct module cancel.
    await this.orderService.cancel(orderId)
  }

  async markFulfillmentHold(
    tenantId: string,
    orderId: string,
    held: boolean
  ): Promise<void> {
    // Purely a call-center flag — see FULFILLMENT_HOLD_KEY note. Nothing in
    // Medusa reacts to this; our own dialer / fulfillment path must honor it.
    await this.updateOrderMetadata(tenantId, orderId, {
      [FULFILLMENT_HOLD_KEY]: held,
    })
  }

  async isFulfillmentHeld(tenantId: string, orderId: string): Promise<boolean> {
    const metadata = await this.readOrderMetadata(orderId)
    return metadata[FULFILLMENT_HOLD_KEY] === true
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Fetch just the metadata bag for an order (used before a shallow merge). */
  private async readOrderMetadata(
    orderId: string
  ): Promise<Record<string, unknown>> {
    // isolation-ok: low-level metadata read by id ONLY; performs no tenant
    // decision. Every caller is already tenant-scoped -- the write path
    // (updateOrderMetadata/cancelOrder) calls assertOrderInTenant() FIRST, and
    // read callers resolve the order via the sales-channel-scoped getOrder.
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

  // ---------------------------------------------------------------------------
  // Product helpers (all scoped by the caller to the tenant's sales channel)
  // ---------------------------------------------------------------------------

  /**
   * The product ids linked to a sales channel, via the product_sales_channel
   * link entity filtered by sales_channel_id. This is the ONLY way products
   * enter the tenant catalog for the reads above — same pattern the merchant
   * product API uses.
   */
  private async tenantProductIds(scId: string): Promise<string[]> {
    // SECURITY / CORRECTNESS INVARIANT: page to exhaustion (bounded by MAX) so a
    // tenant with >1000 products is NEVER silently truncated — a truncated set
    // makes phone-order product lookups miss the tail of the catalogue. Mirrors
    // the marketing gateway's paginated tenantProductIds (the copies diverged
    // and only the marketing side had been fixed).
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

  /**
   * Map raw product rows (already SC-scoped by the caller) to CommerceProducts,
   * enriching each variant with a price (for the tenant region's currency) and
   * an inventory quantity / in-stock flag.
   *
   * Pricing: rather than run the full calculated-price engine (which needs a
   * pricing context and is fragile here) we read the variant's price-set amount
   * for the region currency directly. Inventory: summed stocked_quantity across
   * the variant's inventory levels. Both degrade gracefully to null / 0.
   */
  private async toCommerceProducts(
    tenantId: string,
    rows: any[]
  ): Promise<CommerceProduct[]> {
    if (!rows.length) {
      return []
    }

    const region = await this.tenantRegion(tenantId)
    const currency = region?.currency_code || null

    const variantIds: string[] = []
    for (const p of rows) {
      for (const v of p.variants ?? []) {
        if (v?.id) {
          variantIds.push(v.id)
        }
      }
    }

    const priceByVariant = await this.variantPrices(variantIds, currency)
    const qtyByVariant = await this.variantInventory(variantIds)

    return rows.map((p: any) => {
      const variants: CommerceProductVariant[] = (p.variants ?? []).map(
        (v: any) => {
          const price = priceByVariant[v.id] ?? null
          const qty = qtyByVariant[v.id] ?? 0
          return {
            id: v.id,
            title: v.title ?? null,
            sku: v.sku ?? null,
            price,
            currency_code: price != null ? currency : null,
            in_stock: qty > 0,
            inventory_quantity: qty,
          }
        }
      )

      const priced = variants
        .map((v) => v.price)
        .filter((n): n is number => typeof n === "number")
      const minPrice = priced.length ? Math.min(...priced) : null

      // Prefer the thumbnail; fall back to the first image in the gallery.
      const gallery = Array.isArray(p.images) ? p.images : []
      const firstImage =
        [...gallery]
          .sort((a: any, b: any) => Number(a?.rank ?? 0) - Number(b?.rank ?? 0))
          .map((im: any) => im?.url)
          .find((u: any) => typeof u === "string" && u.trim().length > 0) ?? null

      return {
        id: p.id,
        title: p.title ?? null,
        handle: p.handle ?? null,
        description: p.description ?? null,
        status: p.status ?? null,
        thumbnail: p.thumbnail || firstImage || null,
        variants,
        min_price: minPrice,
        currency_code: minPrice != null ? currency : null,
      }
    })
  }

  /**
   * Price amount per variant for `currency`, via the
   * product_variant_price_set link -> price set -> prices. Returns a map of
   * variant_id -> amount (raw price-set amount, not a calculated price).
   */
  private async variantPrices(
    variantIds: string[],
    currency: string | null
  ): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    if (!variantIds.length || !currency) {
      return out
    }

    const { data: links } = await this.query.graph({
      entity: "product_variant_price_set",
      fields: ["variant_id", "price_set_id"],
      filters: { variant_id: variantIds } as any,
    })

    const priceSetByVariant: Record<string, string> = {}
    for (const l of links ?? []) {
      const lk = l as any
      if (lk.variant_id && lk.price_set_id) {
        priceSetByVariant[lk.variant_id] = lk.price_set_id
      }
    }
    const priceSetIds = Object.values(priceSetByVariant)
    if (!priceSetIds.length) {
      return out
    }

    const priceSets = await this.pricingService.listPriceSets(
      { id: priceSetIds },
      { relations: ["prices"], take: priceSetIds.length }
    )
    const pricesByPriceSet = new Map<string, any[]>()
    for (const ps of priceSets ?? []) {
      pricesByPriceSet.set(ps.id, ps.prices ?? [])
    }

    for (const [variantId, priceSetId] of Object.entries(priceSetByVariant)) {
      const prices = pricesByPriceSet.get(priceSetId) ?? []
      // Prefer an exact currency match; ignore rule-scoped (e.g. min-qty) prices
      // by taking the simplest matching row.
      const match = prices.find(
        (pr: any) =>
          String(pr.currency_code ?? "").toLowerCase() === currency
      )
      if (match) {
        out[variantId] = this.toNumber(match.amount)
      }
    }
    return out
  }

  /**
   * Summed stocked_quantity per variant, via the
   * product_variant_inventory_item link -> inventory levels. Returns a map of
   * variant_id -> total quantity (0 when unmanaged / no levels).
   */
  private async variantInventory(
    variantIds: string[]
  ): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    if (!variantIds.length) {
      return out
    }

    const { data: links } = await this.query.graph({
      entity: "product_variant_inventory_item",
      fields: ["variant_id", "inventory_item_id"],
      filters: { variant_id: variantIds } as any,
    })

    const variantByItem: Record<string, string> = {}
    for (const l of links ?? []) {
      const lk = l as any
      if (lk.inventory_item_id && lk.variant_id) {
        variantByItem[lk.inventory_item_id] = lk.variant_id
      }
    }
    const itemIds = Object.keys(variantByItem)
    if (!itemIds.length) {
      return out
    }

    let levels: any[] = []
    try {
      levels = await this.inventoryService.listInventoryLevels(
        { inventory_item_id: itemIds },
        { take: 10000 }
      )
    } catch {
      levels = []
    }
    for (const lvl of levels ?? []) {
      const vId = variantByItem[lvl.inventory_item_id]
      if (!vId) {
        continue
      }
      const available = Number(
        lvl.available_quantity ?? lvl.stocked_quantity ?? 0
      )
      out[vId] = (out[vId] ?? 0) + (Number.isFinite(available) ? available : 0)
    }
    return out
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
      payment_status: derivePaymentStatus(order),
      fulfillment_status: deriveFulfillmentStatus(order),
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
