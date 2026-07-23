import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition, AiToolCall } from "../../../modules/marketing/ai/ai-provider"
import { computeSetupStatus } from "../_setup"
import { computeAttention } from "./_attention"
import { MORE_TOOL_DEFS, MORE_TOOL_LABELS, runMoreTool } from "./_tools-more"
import { CONNECT_TOOL_DEFS, CONNECT_TOOL_LABELS, runConnectTool } from "./_tools-connect"
import { OPS_TOOL_DEFS, OPS_TOOL_LABELS, runOpsTool } from "./_tools-ops"
import { INSIGHTS_TOOL_DEFS, INSIGHTS_TOOL_LABELS, runInsightsTool } from "./_tools-insights"
import { CONTENT_TOOL_DEFS, CONTENT_TOOL_LABELS, runContentTool } from "./_reads-content"
import { CATALOG_READ_DEFS, CATALOG_READ_LABELS, runCatalogRead } from "./_reads-catalog"
import { BRAND_READ_DEFS, BRAND_READ_LABELS, runBrandReadTool } from "./_reads-brand"
import { addNote } from "./_memory"
import {
  paymentStatusFrom,
  fulfillmentStatusFrom,
  orderMoneyFor,
} from "../orders/_status"

/**
 * Pixi P0 — READ-ONLY tool runtime.
 *
 * Every tool here only LOOKS things up; nothing mutates the shop yet (writes
 * arrive in P1 behind the confirm gate). Each handler is tenant-scoped through
 * the authenticated merchant context (`ctx`) — the tenant is NEVER read from the
 * model's arguments — and NEVER throws: a failure returns `{ error }` the model
 * can read and explain, so a broken tool degrades the answer, not the run.
 *
 * `buildJarvisTools(req, ctx)` returns:
 *   - `definitions`: the JSON-schema tool catalog handed to the model.
 *   - `run(call)`: dispatch one tool call → JSON-serialisable result.
 * The route wraps `run` to stream a live "tool started/finished" event per call.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

/* ------------------------------- readiness ------------------------------- */

async function checkReadiness(req: MedusaRequest, ctx: Ctx) {
  const s = await computeSetupStatus(req, ctx as any)
  return {
    ready_to_sell: s.ready_to_sell,
    percent: s.percent,
    required_percent: s.required_percent,
    missing_required: s.missing_required,
    tasks: (s.tasks ?? []).map((t: any) => ({
      task: t.label,
      done: t.done,
      required: t.required,
      why: t.why,
      blocker: t.blocker_detail ?? null,
    })),
  }
}

/* ------------------------------- overview -------------------------------- */

async function storeOverview(req: MedusaRequest, ctx: Ctx) {
  const scId = ctx.tenant.meta?.sales_channel_id
  const query = q(req)
  let productCount = 0
  let orderCount = 0
  if (scId) {
    const { data: links } = await query
      .graph({
        entity: "product_sales_channel",
        filters: { sales_channel_id: scId } as any,
        fields: ["product_id"],
        pagination: { take: 2000, skip: 0 } as any,
      })
      .catch(() => ({ data: [] }))
    const pids = (links || []).map((l: any) => l.product_id).filter(Boolean)
    if (pids.length) {
      // Exclude the provisioned SAMPLE product — a sample is NOT a real product,
      // and counting it here would contradict check_readiness in the same chat.
      const { data: prods } = await query
        .graph({
          entity: "product",
          filters: { id: pids } as any,
          fields: ["id", "metadata"],
          pagination: { take: 2000, skip: 0 } as any,
        })
        .catch(() => ({ data: [] }))
      productCount = (prods || []).filter((p: any) => !p.metadata?.is_sample).length
    }
    const { data: orders } = await query
      .graph({
        entity: "order",
        filters: { sales_channel_id: scId } as any,
        fields: ["id"],
        pagination: { take: 1000, skip: 0 } as any,
      })
      .catch(() => ({ data: [] }))
    orderCount = (orders || []).length
  }
  const meta = ctx.tenant.meta ?? {}
  return {
    store_name: ctx.tenant.name,
    country: meta.default_country ?? null,
    currency: (meta.currency_code ?? "usd").toUpperCase(),
    ready_to_sell: meta.ready_to_sell ?? null,
    product_count: productCount,
    order_count: orderCount,
    active_theme: meta.active_theme ?? null,
  }
}

/* -------------------------------- orders --------------------------------- */

const ORDER_FIELDS = [
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
  "shipping_address.city",
  "items.id",
  "items.title",
  "items.quantity",
  "payment_collections.status",
  "fulfillments.canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
]

function shapeOrder(o: any, money: Map<string, any>) {
  return {
    order_no: o.metadata?.store_order_no ?? o.display_id,
    status: o.status,
    payment: paymentStatusFrom(o.payment_collections),
    fulfillment: fulfillmentStatusFrom(o.fulfillments),
    total: money.get(o.id)?.total ?? 0,
    currency: (o.currency_code ?? "").toUpperCase(),
    customer:
      [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
      o.email ||
      null,
    country: o.shipping_address?.country_code ?? null,
    placed_at: o.created_at,
  }
}

async function listRecentOrders(req: MedusaRequest, ctx: Ctx, limit = 10) {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { orders: [], count: 0 }
  const query = q(req)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { sales_channel_id: scId } as any,
    pagination: {
      take: Math.max(1, Math.min(25, limit)),
      skip: 0,
      order: { created_at: "DESC" },
    } as any,
  })
  const money = await orderMoneyFor(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    (data || []).map((o: any) => o.id)
  )
  return {
    orders: (data || []).map((o: any) => shapeOrder(o, money)),
    count: (data || []).length,
  }
}

async function getOrder(req: MedusaRequest, ctx: Ctx, orderNo: string | number) {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { error: "store not fully set up" }
  const query = q(req)
  const target = String(orderNo).replace(/[^0-9]/g, "")
  if (!target) return { error: "give an order number, e.g. 1043" }
  // Fetch recent orders for this store and match by the store order number
  // (metadata.store_order_no) or the global display_id — both are shown to
  // merchants. Bounded scan keeps it tenant-safe and simple for P0.
  const { data } = await query.graph({
    entity: "order",
    fields: [...ORDER_FIELDS, "shipping_address.address_1", "shipping_address.phone"],
    filters: { sales_channel_id: scId } as any,
    pagination: { take: 400, skip: 0, order: { created_at: "DESC" } } as any,
  })
  // Prefer the per-store order number the merchant actually sees; only fall
  // back to the global display_id when nothing matches on store_order_no.
  const match =
    (data || []).find((o: any) => String(o.metadata?.store_order_no ?? "") === target) ??
    (data || []).find((o: any) => String(o.display_id ?? "") === target)
  if (!match) return { error: `no order #${target} found in this store` }
  const money = await orderMoneyFor(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    [match.id]
  )
  const base = shapeOrder(match, money)
  return {
    ...base,
    ship_to: [
      match.shipping_address?.address_1,
      match.shipping_address?.city,
      match.shipping_address?.country_code,
    ]
      .filter(Boolean)
      .join(", "),
    phone: match.shipping_address?.phone ?? null,
    items: (match.items || []).map((i: any) => ({
      title: i.title,
      // graph reads item.quantity back as 0 — the real qty is in orderMoneyFor.
      qty: money.get(match.id)?.quantities?.get(i.id) ?? Number(i.quantity ?? 0),
    })),
  }
}

/* ------------------------------- products -------------------------------- */

async function searchProducts(req: MedusaRequest, ctx: Ctx, term: string, limit = 8) {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return { products: [], count: 0 }
  const query = q(req)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
    pagination: { take: 2000, skip: 0 } as any,
  })
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return { products: [], count: 0 }
  const { data: products } = await query.graph({
    entity: "product",
    filters: { id: ids } as any,
    fields: [
      "id",
      "title",
      "status",
      "handle",
      "metadata",
      "variants.title",
      "variants.sku",
    ],
    pagination: { take: 2000, skip: 0 } as any,
  })
  const needle = (term || "").toLowerCase().trim()
  let rows = (products || []).filter(
    (p: any) => !p.metadata?.is_sample
  )
  if (needle) {
    rows = rows.filter((p: any) => (p.title || "").toLowerCase().includes(needle))
  }
  return {
    count: rows.length,
    products: rows.slice(0, Math.max(1, Math.min(20, limit))).map((p: any) => ({
      title: p.title,
      status: p.status,
      variants: (p.variants || []).length,
      variant_names: (p.variants || []).map((v: any) => v.title).slice(0, 6),
    })),
  }
}

/* ------------------------------- registry -------------------------------- */

export function buildJarvisTools(req: MedusaRequest, ctx: Ctx): {
  definitions: AiToolDefinition[]
  run: (call: AiToolCall) => Promise<unknown>
} {
  const definitions: AiToolDefinition[] = [
    {
      name: "check_readiness",
      description:
        "Check whether the store is ready to sell and exactly what setup is still missing (shipping, payment, products, store country, etc.). Use for 'is my shop ready', 'what's left to set up', 'why can't customers order'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "store_overview",
      description:
        "High-level snapshot of the store: name, country, currency, whether it's ready to sell, number of products and total orders. Use to answer 'how's my shop', 'give me an overview'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_recent_orders",
      description:
        "List the store's most recent orders with status, payment and fulfilment state, total and customer. Use for 'show my orders', 'any new orders', 'recent sales'.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many orders (1-25, default 10)" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_order",
      description:
        "Get full detail of ONE order by its order number (e.g. 1043): items, total, status, payment, shipping address. Use when the merchant asks about a specific order.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "The order number, e.g. '1043'" },
        },
        required: ["order_number"],
        additionalProperties: false,
      },
    },
    {
      name: "search_products",
      description:
        "Search the store's products by name; returns title, status and variants. Use for 'do I have <product>', 'find product', 'list my products'. Leave query empty to list products.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product name to search for (optional)" },
          limit: { type: "number", description: "Max results (1-20, default 8)" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "needs_attention",
      description:
        "Get the prioritised list of things that currently need the merchant's attention: setup blockers stopping sales, orders that are paid but not yet fulfilled or awaiting payment, and products low on stock. Use for 'what should I fix', 'what needs my attention', 'what's urgent', 'anything I should do'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "remember",
      description:
        "Save a fact or preference the merchant wants you to remember about their shop for future conversations (e.g. 'we only ship within Dhaka', 'my supplier restocks on Mondays', 'always keep free shipping over 2000'). Use when the merchant says remember/note/keep in mind. Do NOT use it to perform an action — only to store a note.",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string", description: "The fact to remember, in one short sentence." },
        },
        required: ["note"],
        additionalProperties: false,
      },
    },
  ]
  definitions.push(...MORE_TOOL_DEFS)
  definitions.push(...CONNECT_TOOL_DEFS)
  definitions.push(...OPS_TOOL_DEFS)
  definitions.push(...INSIGHTS_TOOL_DEFS)
  definitions.push(...CONTENT_TOOL_DEFS)
  definitions.push(...CATALOG_READ_DEFS)
  definitions.push(...BRAND_READ_DEFS)

  const run = async (call: AiToolCall): Promise<unknown> => {
    const a = (call.arguments ?? {}) as Record<string, any>
    try {
      switch (call.name) {
        case "check_readiness":
          return await checkReadiness(req, ctx)
        case "store_overview":
          return await storeOverview(req, ctx)
        case "list_recent_orders":
          return await listRecentOrders(req, ctx, Number(a.limit) || 10)
        case "get_order":
          return await getOrder(req, ctx, a.order_number ?? a.order_no ?? "")
        case "search_products":
          return await searchProducts(req, ctx, String(a.query ?? ""), Number(a.limit) || 8)
        case "needs_attention":
          return await computeAttention(req, ctx as any)
        case "remember":
          return await addNote(req, ctx.tenant.id, String(a.note ?? ""))
        case "sales_summary":
        case "low_stock":
        case "find_customer":
        case "inbox_status":
          return await runMoreTool(req, ctx as any, call.name, a)
        case "domain_status":
        case "call_center_status":
          return await runConnectTool(req, ctx as any, call.name, a)
        case "orders_to_deliver":
        case "delivery_issues":
        case "needs_human":
        case "todays_email":
          return await runOpsTool(req, ctx as any, call.name, a)
        case "visitor_report":
        case "call_topics":
        case "ad_report":
        case "compare_ads":
          return await runInsightsTool(req, ctx as any, call.name, a)
        case "list_blog_posts":
        case "list_pages":
          return await runContentTool(req, ctx as any, call.name, a)
        case "list_collections":
        case "list_categories":
        case "list_discounts":
          return await runCatalogRead(req, ctx as any, call.name, a)
        case "list_themes":
        case "list_campaigns":
        case "search_domain":
          return await runBrandReadTool(req, ctx as any, call.name, a)
        default:
          return { error: `unknown tool: ${call.name}` }
      }
    } catch (e: any) {
      return { error: e?.message || "tool failed" }
    }
  }

  return { definitions, run }
}

/** Short human label for the live "Pixi is doing X" stream event. */
export const TOOL_LABELS: Record<string, string> = {
  check_readiness: "Checking what your shop still needs",
  store_overview: "Getting a snapshot of your shop",
  list_recent_orders: "Looking up your recent orders",
  get_order: "Pulling up that order",
  search_products: "Searching your products",
  needs_attention: "Checking what needs your attention",
  remember: "Making a note of that",
  ...MORE_TOOL_LABELS,
  ...CONNECT_TOOL_LABELS,
  ...OPS_TOOL_LABELS,
  ...INSIGHTS_TOOL_LABELS,
  ...CONTENT_TOOL_LABELS,
  ...CATALOG_READ_LABELS,
  ...BRAND_READ_LABELS,
}
