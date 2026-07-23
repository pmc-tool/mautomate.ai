import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { computeSetupStatus } from "../_setup"
import { paymentStatusFrom, fulfillmentStatusFrom } from "../orders/_status"
import { getAvailableByVariant } from "../_inventory"

/**
 * Pixi — the "needs attention" engine.
 *
 * One tenant-scoped digest of everything the merchant should act on right now:
 * setup blockers that stop the store selling, orders waiting on the merchant,
 * and stock running low. Powers the attention strip in the Pixi panel.
 *
 * Contract, mirrored from the read-only tool runtime:
 *   - Tenant is read ONLY from `ctx` (never from model/route args).
 *   - Every source is wrapped in try/catch and NEVER throws: a failing source
 *     simply contributes no items, so a broken check degrades the digest
 *     instead of breaking the endpoint.
 *   - Items come back sorted blocker → warn → info and capped, so the UI can
 *     render them straight through.
 */

export type AttentionItem = {
  id: string
  severity: "blocker" | "warn" | "info"
  title: string
  detail: string
  cta?: { label: string; prompt?: string; href?: string }
}

type Ctx = { tenant: any; merchant: any; svc: any }

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

const SEVERITY_ORDER: Record<AttentionItem["severity"], number> = {
  blocker: 0,
  warn: 1,
  info: 2,
}

const MAX_ITEMS = 6

// Paid enough to be actioned; ready to fulfil.
const PAID_STATUSES = new Set(["captured", "partially_captured"])
// Payment initiated but not yet collected.
const AWAITING_PAYMENT_STATUSES = new Set([
  "awaiting",
  "authorized",
  "partially_authorized",
  "not_paid",
])
// Fulfillment states that mean the merchant no longer needs to act.
const FULFILLED_STATUSES = new Set(["fulfilled", "shipped", "delivered", "canceled"])

const ATTENTION_ORDER_FIELDS = [
  "id",
  "status",
  "payment_collections.status",
  "fulfillments.canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
]

/** Map a missing required setup task to a helpful CTA. */
function ctaForSetupKey(key: string): AttentionItem["cta"] {
  switch (key) {
    case "shipping":
      return { label: "Set up delivery", prompt: "Set up delivery" }
    case "payment":
      return { label: "Turn on a payment method", prompt: "Enable cash on delivery" }
    case "products":
      return { label: "Add a product", href: "/dashboard/products/new" }
    default:
      // store_country, currency, store details, and anything else → the wizard.
      return { label: "Finish setup", href: "/dashboard/setup" }
  }
}

/* --------------------------- source: readiness --------------------------- */

async function readinessItems(
  req: MedusaRequest,
  ctx: Ctx
): Promise<{ ready: boolean; items: AttentionItem[] }> {
  try {
    const s = await computeSetupStatus(req, ctx as any)
    if (s.ready_to_sell) return { ready: true, items: [] }

    const byKey = new Map<string, any>((s.tasks ?? []).map((t: any) => [t.key, t]))
    const items: AttentionItem[] = []
    for (const key of s.missing_required ?? []) {
      const task = byKey.get(key)
      items.push({
        id: `setup:${key}`,
        severity: "blocker",
        title: task?.label ?? "Finish store setup",
        detail:
          task?.blocker_detail ??
          task?.why ??
          "Finish this step before your store can take orders.",
        cta: ctaForSetupKey(key),
      })
    }
    return { ready: false, items }
  } catch {
    return { ready: false, items: [] }
  }
}

/* ----------------------------- source: orders ---------------------------- */

async function orderItems(req: MedusaRequest, ctx: Ctx): Promise<AttentionItem[]> {
  try {
    const scId = ctx.tenant.meta?.sales_channel_id
    if (!scId) return []
    const query = q(req)
    const { data } = await query.graph({
      entity: "order",
      fields: ATTENTION_ORDER_FIELDS,
      filters: { sales_channel_id: scId } as any,
      pagination: {
        take: 100,
        skip: 0,
        order: { created_at: "DESC" },
      } as any,
    })

    let readyToFulfil = 0
    let awaitingPayment = 0
    for (const o of data || []) {
      if (o.status === "canceled") continue
      const payment = paymentStatusFrom((o as any).payment_collections)
      const fulfillment = fulfillmentStatusFrom((o as any).fulfillments)
      if (PAID_STATUSES.has(payment) && !FULFILLED_STATUSES.has(fulfillment)) {
        readyToFulfil++
      } else if (AWAITING_PAYMENT_STATUSES.has(payment)) {
        awaitingPayment++
      }
    }

    const items: AttentionItem[] = []
    if (readyToFulfil > 0) {
      items.push({
        id: "orders:ready_to_fulfil",
        severity: "warn",
        title: `${readyToFulfil} order${readyToFulfil === 1 ? "" : "s"} ready to fulfil`,
        detail: "Paid and waiting to be prepared and shipped.",
        cta: {
          label: "Review orders to fulfil",
          prompt: "Show my orders that are paid but not fulfilled",
        },
      })
    }
    if (awaitingPayment > 0) {
      items.push({
        id: "orders:awaiting_payment",
        severity: "info",
        title: `${awaitingPayment} order${awaitingPayment === 1 ? "" : "s"} awaiting payment`,
        detail: "Placed but payment has not been collected yet.",
      })
    }
    return items
  } catch {
    return []
  }
}

/* --------------------------- source: low stock --------------------------- */

async function lowStockItems(req: MedusaRequest, ctx: Ctx): Promise<AttentionItem[]> {
  try {
    const scId = ctx.tenant.meta?.sales_channel_id
    if (!scId) return []
    const query = q(req)

    // Real (non-sample) products in the tenant's sales channel.
    const { data: links } = await query.graph({
      entity: "product_sales_channel",
      filters: { sales_channel_id: scId } as any,
      fields: ["product_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    const pids = (links || []).map((l: any) => l.product_id).filter(Boolean)
    if (!pids.length) return []

    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: pids } as any,
      fields: ["id", "metadata", "variants.id", "variants.manage_inventory"],
      pagination: { take: 2000, skip: 0 } as any,
    })

    // Collect managed variants of real products, capped to keep the scan cheap.
    const VARIANT_SCAN_CAP = 50
    const variantIds: string[] = []
    for (const p of products || []) {
      if ((p as any).metadata?.is_sample) continue
      for (const v of (p as any).variants || []) {
        if (!v?.id) continue
        if (v.manage_inventory === false) continue
        variantIds.push(v.id)
        if (variantIds.length >= VARIANT_SCAN_CAP) break
      }
      if (variantIds.length >= VARIANT_SCAN_CAP) break
    }
    if (!variantIds.length) return []

    // Only variants with an actual inventory level appear here → inventory is
    // genuinely managed for them.
    const available = await getAvailableByVariant(req, variantIds)
    let lowCount = 0
    for (const vId of Object.keys(available)) {
      if (available[vId] <= 3) lowCount++
    }
    if (lowCount === 0) return []

    return [
      {
        id: "inventory:low_stock",
        severity: "warn",
        title: `${lowCount} product${lowCount === 1 ? "" : "s"} low on stock`,
        detail: "Running low — restock before they sell out.",
        cta: {
          label: "See low stock",
          prompt: "Which products are low on stock?",
        },
      },
    ]
  } catch {
    return []
  }
}

/* ------------------------------ source: domain -------------------------- */

async function domainItems(
  req: MedusaRequest,
  ctx: Ctx,
  readyToSell: boolean
): Promise<AttentionItem[]> {
  try {
    const domains = await ctx.svc.listTenantDomains({ tenant_id: ctx.tenant.id })
    const custom = (domains || []).filter((d: any) => d?.type !== "free")
    const isLive = (d: any) =>
      /verified|active|live/i.test(String(d?.verification_status ?? "")) &&
      /active|issued|live/i.test(String(d?.ssl_status ?? ""))
    const pending = custom.filter((d: any) => !isLive(d))

    // A custom domain was added but not finished — always worth a nudge.
    if (pending.length) {
      const d = pending[0]
      return [
        {
          id: "domain:pending",
          severity: "warn",
          title: `Finish connecting ${d.domain}`,
          detail:
            "It isn't verified yet — change your domain's nameservers at your registrar, then click Verify in Settings → Domains.",
          cta: { label: "Domain status", prompt: "What's the status of my custom domain?" },
        },
      ]
    }

    // No own domain yet: a soft suggestion, only once the store can actually
    // sell (don't distract a brand-new store still finishing setup).
    if (!custom.length && readyToSell) {
      return [
        {
          id: "domain:connect",
          severity: "info",
          title: "Use your own domain",
          detail: "Your store runs on a mautomate.ai address — connect your own domain for a branded storefront.",
          cta: { label: "How to connect", prompt: "How do I connect my own domain?" },
        },
      ]
    }
    return []
  } catch {
    return []
  }
}

/* -------------------------------- compute -------------------------------- */

export async function computeAttention(
  req: MedusaRequest,
  ctx: Ctx
): Promise<{ ready_to_sell: boolean; items: AttentionItem[] }> {
  const readiness = await readinessItems(req, ctx)
  const [orders, lowStock, domain] = await Promise.all([
    orderItems(req, ctx),
    lowStockItems(req, ctx),
    domainItems(req, ctx, readiness.ready),
  ])

  const items = [...readiness.items, ...orders, ...lowStock, ...domain]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_ITEMS)

  return { ready_to_sell: readiness.ready, items }
}
