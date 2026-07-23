import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  createOrderFulfillmentWorkflow,
  cancelOrderFulfillmentWorkflow,
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  updateServiceZonesWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/core-flows"
import { fulfillmentStatusFrom } from "../orders/_status"
import { getOrCreateDefaultLocation } from "../_inventory"
import {
  getQuery,
  ensureProviderLinked,
  defaultProfileId,
  tenantCurrency,
  MANUAL_PROVIDER,
} from "../_shipping"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"
import {
  gatewayById,
  requiredCredentialKeys,
} from "../../../modules/payments/registry"

/**
 * Pixi P1 — SOFT WRITE tools.
 *
 * These are the low-risk actions a merchant can approve with a single tap. The
 * design keeps a hard wall between deciding and doing:
 *
 *   - `plan()` NEVER mutates. It resolves the human's words into concrete,
 *     tenant-owned ids (an order by its number, a product by its title — exactly
 *     the way the read-only P0 runtime resolves them), validates the request,
 *     and returns `{ human_summary, details, apply_args }` for the confirm card.
 *     Bad input comes back as `{ ok:false, error }` — a friendly sentence, never
 *     a stack trace.
 *   - `apply()` runs ONLY the ids `plan()` produced (the model never supplies an
 *     id or a tenant) by calling the same core-flows workflow the REST route
 *     uses, and returns `{ result, undo? }`.
 *
 * Tenancy is taken from `ctx` on every path (`ctx.tenant.meta.sales_channel_id`
 * for catalog/orders, `ctx.tenant.id` for config) — cross-tenant access is
 * impossible because a lookup that misses the tenant's sales channel simply
 * returns "not found". Nothing here leaks an internal error to the merchant.
 *
 * Undo model: the three symmetric writes are self-reversing — their `undo`
 * re-invokes the SAME tool's `apply()` with the inverse `apply_args` (publish ->
 * previous status, enable -> disable, new price -> previous price), because
 * `apply()` reads its effect straight from `apply_args`. Fulfilment is not
 * symmetric, so its undo names a `cancel_fulfillment` action carrying the fresh
 * fulfilment id. Delivery setup is idempotent, so it declares no undo.
 */

export type Ctx = { tenant: any; merchant: any; svc: any }

export type PlanResult =
  | {
      ok: true
      human_summary: string
      details: Record<string, unknown>
      apply_args: Record<string, any>
    }
  | { ok: false; error: string }

export type ApplyResult = {
  result: any
  undo?:
    | { action: string; apply_args: Record<string, any> }
    | { available: false; reason: string }
}

export type JarvisWrite = {
  name: string
  description: string
  parameters: Record<string, unknown>
  risk: "low" | "med" | "high"
  tier: "soft" | "hard"
  requireText?: string
  plan(req: MedusaRequest, ctx: Ctx, args: Record<string, any>): Promise<PlanResult>
  apply(
    req: MedusaRequest,
    ctx: Ctx,
    applyArgs: Record<string, any>
  ): Promise<ApplyResult>
}

/* ------------------------------- internals ------------------------------- */

const q = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.QUERY)

const scOf = (ctx: Ctx): string | null => ctx.tenant?.meta?.sales_channel_id ?? null

/** Turn any thrown error into a short, merchant-safe sentence. */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  // Never surface stack traces, SQL, or internal ids in the message.
  if (!msg || msg.length > 160 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

const CUR = (c?: string, fallback = "usd") => (c || fallback).toLowerCase()

/**
 * Resolve ONE tenant-owned product from a free-text query, the same way P0's
 * search_products does: only products linked to this store's sales channel, and
 * the provisioned SAMPLE product is never a match. Prefers an exact
 * (case-insensitive) title, else a unique substring match.
 */
async function resolveProduct(
  req: MedusaRequest,
  ctx: Ctx,
  term: string
): Promise<
  | { ok: true; product: { id: string; title: string; status: string; variants: any[] } }
  | { ok: false; error: string }
> {
  const scId = scOf(ctx)
  if (!scId) return { ok: false, error: "Your store isn't fully set up yet." }
  const needle = (term || "").toLowerCase().trim()
  if (!needle) return { ok: false, error: "Tell me which product, e.g. \"Blue Kaftan\"." }

  const query = q(req)
  const { data: links } = await query
    .graph({
      entity: "product_sales_channel",
      filters: { sales_channel_id: scId } as any,
      fields: ["product_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }

  const { data: products } = await query
    .graph({
      entity: "product",
      filters: { id: ids } as any,
      fields: ["id", "title", "status", "metadata", "variants.id", "variants.title"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))

  const rows = (products || []).filter((p: any) => !p.metadata?.is_sample)
  const exact = rows.filter((p: any) => (p.title || "").toLowerCase() === needle)
  const partial = rows.filter((p: any) => (p.title || "").toLowerCase().includes(needle))
  const matches = exact.length ? exact : partial

  if (!matches.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p: any) => `"${p.title}"`).join(", ")
    return {
      ok: false,
      error: `That matched ${matches.length} products (${names}). Which one did you mean?`,
    }
  }
  const p = matches[0]
  return {
    ok: true,
    product: {
      id: p.id,
      title: p.title,
      status: p.status,
      variants: p.variants || [],
    },
  }
}

/**
 * Current prices for a set of variants, in the same shape the price workflow
 * takes ({ currency_code, amount }). Mirrors the merchant prices route: variant
 * -> price_set link, then the pricing module for the actual prices. Used to
 * capture the "before" so a price change can be undone.
 */
async function loadVariantPrices(
  req: MedusaRequest,
  variantIds: string[]
): Promise<Record<string, { currency_code: string; amount: number }[]>> {
  if (!variantIds.length) return {}
  const query = q(req)
  const { data: links } = await query
    .graph({
      entity: "product_variant_price_set",
      filters: { variant_id: variantIds } as any,
      fields: ["variant_id", "price_set_id"],
    })
    .catch(() => ({ data: [] as any[] }))

  const priceSetByVariant: Record<string, string> = {}
  for (const link of links || []) {
    const l = link as any
    if (l.variant_id && l.price_set_id) priceSetByVariant[l.variant_id] = l.price_set_id
  }
  const priceSetIds = Object.values(priceSetByVariant)
  if (!priceSetIds.length) return {}

  const pricing: any = req.scope.resolve(Modules.PRICING)
  const priceSets = await pricing
    .listPriceSets({ id: priceSetIds }, { relations: ["prices"], take: priceSetIds.length })
    .catch(() => [])
  const byPriceSet = new Map<string, any[]>()
  for (const ps of priceSets || []) byPriceSet.set(ps.id, ps.prices || [])

  const out: Record<string, { currency_code: string; amount: number }[]> = {}
  for (const [variantId, priceSetId] of Object.entries(priceSetByVariant)) {
    out[variantId] = (byPriceSet.get(priceSetId) || [])
      .filter((p: any) => !p.price_list_id)
      .map((p: any) => ({ currency_code: p.currency_code, amount: p.amount }))
  }
  return out
}

/**
 * Resolve ONE tenant-owned order by the number the merchant sees — the per-store
 * order number (metadata.store_order_no) first, then the global display_id —
 * exactly like P0's get_order. Bounded, tenant-scoped scan.
 */
async function resolveOrder(
  req: MedusaRequest,
  ctx: Ctx,
  orderNo: string | number
): Promise<{ ok: true; order: any } | { ok: false; error: string }> {
  const scId = scOf(ctx)
  if (!scId) return { ok: false, error: "Your store isn't fully set up yet." }
  const target = String(orderNo ?? "").replace(/[^0-9]/g, "")
  if (!target) return { ok: false, error: "Give me an order number, e.g. 1043." }

  const query = q(req)
  const { data } = await query
    .graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "metadata",
        "status",
        "items.id",
        "items.quantity",
        "fulfillments.canceled_at",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
      ],
      filters: { sales_channel_id: scId } as any,
      pagination: { take: 400, skip: 0, order: { created_at: "DESC" } } as any,
    })
    .catch(() => ({ data: [] as any[] }))

  const match =
    (data || []).find((o: any) => String(o.metadata?.store_order_no ?? "") === target) ??
    (data || []).find((o: any) => String(o.display_id ?? "") === target)
  if (!match) return { ok: false, error: `I couldn't find order #${target} in your store.` }
  return { ok: true, order: match }
}

const orderNoOf = (o: any): string | number => o.metadata?.store_order_no ?? o.display_id

/* --------------------------- 1. make_product_sellable -------------------- */

const makeProductSellable: JarvisWrite = {
  name: "make_product_sellable",
  description:
    "Publish a product so customers can see and buy it. Use for 'publish <product>', 'make <product> live', 'put <product> on sale in my store'. Takes a product name.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: "The product's name, e.g. 'Blue Kaftan'." },
    },
    required: ["product_query"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const found = await resolveProduct(req, ctx, String(args.product_query ?? ""))
    if (!found.ok) return { ok: false, error: found.error }
    const p = found.product
    if (p.status === "published") {
      return { ok: false, error: `"${p.title}" is already published and on sale.` }
    }
    return {
      ok: true,
      human_summary: `Publish "${p.title}" so customers can buy it?`,
      details: { product: p.title, from: p.status, to: "published" },
      apply_args: { product_id: p.id, status: "published", previous_status: p.status },
    }
  },

  async apply(req, _ctx, applyArgs) {
    const status = applyArgs.status || "published"
    try {
      const { result } = await updateProductsWorkflow(req.scope).run({
        input: { products: [{ id: applyArgs.product_id, status }] },
      })
      return {
        result,
        undo: {
          action: "make_product_sellable",
          apply_args: {
            product_id: applyArgs.product_id,
            status: applyArgs.previous_status || "draft",
            previous_status: status,
          },
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't publish that product.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ------------------------------ 2. setup_delivery ------------------------ */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "delivery"
}

async function loadShippingSet(query: any, locationId: string) {
  const { data } = await query.graph({
    entity: "stock_location",
    filters: { id: locationId } as any,
    fields: [
      "id",
      "fulfillment_sets.id",
      "fulfillment_sets.type",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.geo_zones.country_code",
      "fulfillment_sets.service_zones.shipping_options.id",
    ],
  })
  const loc = data?.[0]
  const sets: any[] = loc?.fulfillment_sets || []
  return sets.find((s) => s.type === "shipping") || sets[0] || null
}

const setupDelivery: JarvisWrite = {
  name: "setup_delivery",
  description:
    "Set up a working delivery option so customers can check out: which countries you ship to and either free or a flat shipping fee. Use for 'let me ship to the US and UK', 'add free delivery', 'charge $5 shipping'.",
  parameters: {
    type: "object",
    properties: {
      countries: {
        type: "array",
        items: { type: "string", description: "ISO-2 country code, e.g. 'us'" },
        description: "The countries you deliver to (ISO-2 codes).",
      },
      price_type: {
        type: "string",
        enum: ["free", "flat"],
        description: "'free' for free delivery, 'flat' for a fixed fee.",
      },
      amount: { type: "number", description: "The flat fee (major units) when price_type is 'flat'." },
    },
    required: ["countries", "price_type"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const raw = Array.isArray(args.countries) ? args.countries : []
    const countries = raw
      .map((c: any) => String(c || "").toLowerCase().trim())
      .filter((c: string) => /^[a-z]{2}$/.test(c))
    if (!countries.length) {
      return { ok: false, error: "Tell me which countries you deliver to, e.g. US and UK." }
    }
    if (countries.length > 50) {
      return { ok: false, error: "That's too many countries at once (max 50)." }
    }
    const priceType = args.price_type === "flat" ? "flat" : "free"
    let amount = 0
    if (priceType === "flat") {
      amount = Number(args.amount)
      if (!Number.isFinite(amount) || amount < 0) {
        return { ok: false, error: "Give me a valid flat delivery fee, e.g. 5." }
      }
      amount = Math.round(amount)
    }
    const currency = CUR(ctx.tenant?.meta?.currency_code)
    const list = countries.map((c) => c.toUpperCase()).join(", ")
    const priceLabel = priceType === "free" ? "free delivery" : `${currency.toUpperCase()} ${amount} delivery`
    return {
      ok: true,
      human_summary: `Set up ${priceLabel} to ${list} so customers can check out?`,
      details: { countries: countries.map((c) => c.toUpperCase()), price_type: priceType, amount, currency: currency.toUpperCase() },
      apply_args: { countries, price_type: priceType, amount },
    }
  },

  async apply(req, ctx, applyArgs) {
    const countries: string[] = (applyArgs.countries || []).map((c: string) => c.toLowerCase())
    const priceType: "free" | "flat" = applyArgs.price_type === "flat" ? "flat" : "free"
    const amount = priceType === "free" ? 0 : Math.round(Number(applyArgs.amount) || 0)
    const query = getQuery(req)
    const noUndo = {
      available: false as const,
      reason: "Delivery setup is additive and idempotent, so there's nothing to undo.",
    }
    try {
      const locationId = await getOrCreateDefaultLocation(req, ctx as any)
      if (!locationId) {
        return { result: { ok: false, error: "I couldn't find a place to ship from." }, undo: noUndo }
      }
      await ensureProviderLinked(req, query, locationId)

      let shippingSet = await loadShippingSet(query, locationId)
      if (!shippingSet) {
        await createLocationFulfillmentSetWorkflow(req.scope).run({
          input: {
            location_id: locationId,
            fulfillment_set_data: {
              name: `${ctx.tenant.name || "Store"} shipping (${ctx.tenant.slug})`,
              type: "shipping",
            },
          },
        })
        shippingSet = await loadShippingSet(query, locationId)
      }
      if (!shippingSet?.id) {
        return { result: { ok: false, error: "I couldn't set up shipping for your store." }, undo: noUndo }
      }

      const zones: any[] = shippingSet.service_zones || []
      let zone = zones[0] || null
      if (zone) {
        const existing = new Set(
          (zone.geo_zones || [])
            .map((g: any) => String(g.country_code || "").toLowerCase())
            .filter(Boolean)
        )
        countries.forEach((c) => existing.add(c))
        await updateServiceZonesWorkflow(req.scope).run({
          input: {
            selector: { id: zone.id },
            update: {
              geo_zones: Array.from(existing).map((c) => ({ type: "country" as const, country_code: c })),
            },
          },
        })
      } else {
        await createServiceZonesWorkflow(req.scope).run({
          input: {
            data: [
              {
                fulfillment_set_id: shippingSet.id,
                name: `Delivery (${ctx.tenant.slug})`,
                geo_zones: countries.map((c) => ({ type: "country" as const, country_code: c })),
              },
            ],
          },
        })
      }

      shippingSet = await loadShippingSet(query, locationId)
      zone = (shippingSet?.service_zones || [])[0] || null
      if (!zone?.id) {
        return { result: { ok: false, error: "I couldn't create a delivery zone." }, undo: noUndo }
      }

      let shippingOptionId: string | null = (zone.shipping_options || [])[0]?.id ?? null
      if (!shippingOptionId) {
        const profileId = await defaultProfileId(query)
        if (!profileId) {
          return { result: { ok: false, error: "No shipping profile is available yet." }, undo: noUndo }
        }
        const currency = await tenantCurrency(query, ctx.tenant)
        const isFree = priceType === "free"
        const name = isFree ? "Free Delivery" : "Standard Delivery"
        const { result } = await createShippingOptionsWorkflow(req.scope).run({
          input: [
            {
              name,
              service_zone_id: zone.id,
              shipping_profile_id: profileId,
              provider_id: MANUAL_PROVIDER,
              price_type: "flat",
              type: { label: name, code: slugify(name), description: name },
              prices: [{ currency_code: currency, amount: isFree ? 0 : amount }],
              data: { id: "manual-fulfillment" },
              rules: [
                { attribute: "is_return", operator: "eq", value: "false" },
                { attribute: "enabled_in_store", operator: "eq", value: "true" },
              ],
            },
          ],
        })
        shippingOptionId = (result as any)?.[0]?.id ?? null
      }

      return {
        result: {
          ok: true,
          location_id: locationId,
          service_zone_id: zone.id,
          shipping_option_id: shippingOptionId,
          countries: (zone.geo_zones || [])
            .map((g: any) => String(g.country_code || "").toLowerCase())
            .filter(Boolean),
        },
        undo: noUndo,
      }
    } catch (e: any) {
      return { result: { ok: false, error: friendly(e, "I couldn't set up delivery.") }, undo: noUndo }
    }
  },
}

/* ------------------------- 3. enable_payment_gateway --------------------- */

// The model may say "cash on delivery" or "COD"; the only always-keyless,
// no-credentials gateway the platform ships is the manual bank-transfer
// provider, so map those phrasings onto it.
const KEYLESS_ALIASES: Record<string, string> = {
  cod: "bank_transfer",
  cash: "bank_transfer",
  cash_on_delivery: "bank_transfer",
  manual: "bank_transfer",
  bank: "bank_transfer",
  bank_transfer: "bank_transfer",
}

const CONFIG_KEY = (id: string) => `gateway.${id}.config`

const enablePaymentGateway: JarvisWrite = {
  name: "enable_payment_gateway",
  description:
    "Turn a keyless payment method (bank transfer / cash on delivery) on or off at checkout. Use for 'let customers pay by bank transfer', 'enable cash on delivery', 'turn off manual payment'. Gateways that need API keys (Stripe, PayPal, etc.) must be configured in Settings first.",
  parameters: {
    type: "object",
    properties: {
      gateway_id: {
        type: "string",
        description: "The payment method, e.g. 'bank_transfer', 'cash_on_delivery'.",
      },
      enabled: { type: "boolean", description: "true to turn it on, false to turn it off." },
    },
    required: ["gateway_id", "enabled"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const rawId = String(args.gateway_id ?? "").trim().toLowerCase()
    if (!rawId) return { ok: false, error: "Which payment method should I change?" }
    const resolvedId = KEYLESS_ALIASES[rawId] ?? rawId
    const gateway = gatewayById(resolvedId)
    if (!gateway) return { ok: false, error: `I don't recognise the payment method "${args.gateway_id}".` }

    // Only keyless gateways are one-tap; anything needing credentials must be
    // configured with the merchant's own keys in Settings first.
    if (requiredCredentialKeys(gateway).length > 0) {
      return { ok: false, error: `Add your ${gateway.name} keys in Settings → Payments first.` }
    }

    const enabled = args.enabled === true
    return {
      ok: true,
      human_summary: enabled
        ? `Turn on ${gateway.name} so customers can pay with it?`
        : `Turn off ${gateway.name} at checkout?`,
      details: { gateway: gateway.name, enabled },
      apply_args: { gateway_id: gateway.id, enabled },
    }
  },

  async apply(req, ctx, applyArgs) {
    const gateway = gatewayById(String(applyArgs.gateway_id ?? ""))
    if (!gateway) {
      return {
        result: { ok: false, error: "That payment method is no longer available." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    const enabled = applyArgs.enabled === true
    const regions = gateway.countries.includes("*") ? ["*"] : gateway.countries.slice()
    try {
      const cfg = new EncryptedConfigService(req.scope)
      await cfg.setConfig(ctx.tenant.id, CONFIG_KEY(gateway.id), {
        enabled,
        enabled_regions: regions,
      })
      return {
        result: { ok: true, gateway: gateway.name, enabled },
        undo: {
          action: "enable_payment_gateway",
          apply_args: { gateway_id: gateway.id, enabled: !enabled },
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, `I couldn't change ${gateway.name}.`) },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ---------------------------- 4. set_product_price ----------------------- */

const setProductPrice: JarvisWrite = {
  name: "set_product_price",
  description:
    "Set the price of a product (all of its variants) in your store currency. Use for 'price the Blue Kaftan at 49', 'change <product> to $29.99'. Takes a product name and an amount.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: "The product's name, e.g. 'Blue Kaftan'." },
      amount: { type: "number", description: "The new price in major units, e.g. 49.99." },
      currency_code: {
        type: "string",
        description: "3-letter currency code; defaults to your store currency.",
      },
    },
    required: ["product_query", "amount"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const amount = Number(args.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: "Give me a valid price, e.g. 49.99." }
    }
    const found = await resolveProduct(req, ctx, String(args.product_query ?? ""))
    if (!found.ok) return { ok: false, error: found.error }
    const p = found.product
    const variantIds = (p.variants || []).map((v: any) => v.id).filter(Boolean)
    if (!variantIds.length) {
      return { ok: false, error: `"${p.title}" has no variants to price yet.` }
    }
    const currency = CUR(args.currency_code || ctx.tenant?.meta?.currency_code)

    // Capture the current prices so the change can be undone.
    const prev = await loadVariantPrices(req, variantIds)
    const updates = variantIds.map((id: string) => ({
      variant_id: id,
      prices: [{ currency_code: currency, amount }],
    }))
    const previousUpdates = variantIds.map((id: string) => ({
      variant_id: id,
      prices: prev[id] || [],
    }))
    const hasPrev = variantIds.some((id: string) => (prev[id] || []).length > 0)

    const cur = currency.toUpperCase()
    const summary =
      variantIds.length === 1
        ? `Set the price of "${p.title}" to ${cur} ${amount}?`
        : `Set the price of all ${variantIds.length} variants of "${p.title}" to ${cur} ${amount}?`
    return {
      ok: true,
      human_summary: summary,
      details: { product: p.title, variants: variantIds.length, price: `${cur} ${amount}` },
      apply_args: { updates, previous_updates: previousUpdates, has_previous: hasPrev },
    }
  },

  async apply(req, _ctx, applyArgs) {
    const updates: { variant_id: string; prices: any[] }[] = applyArgs.updates || []
    if (!updates.length) {
      return {
        result: { ok: false, error: "There was nothing to price." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      const { result } = await updateProductVariantsWorkflow(req.scope).run({
        input: {
          product_variants: updates.map((u) => ({ id: u.variant_id, prices: u.prices })),
        },
      })
      const previousUpdates = applyArgs.previous_updates
      const undo =
        applyArgs.has_previous && Array.isArray(previousUpdates)
          ? {
              action: "set_product_price",
              apply_args: { updates: previousUpdates, previous_updates: updates, has_previous: true },
            }
          : {
              available: false as const,
              reason: "This product had no price before, so there's nothing to revert to.",
            }
      return { result, undo }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't update that price.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ------------------------------- 5. fulfil_order ------------------------- */

const fulfilOrder: JarvisWrite = {
  name: "fulfil_order",
  description:
    "Mark an order as fulfilled (all its items) so it's ready to ship, optionally with a tracking number. Use for 'fulfil order 1043', 'mark order 1043 shipped', 'process order 1043'. Takes the order number.",
  parameters: {
    type: "object",
    properties: {
      order_no: { type: "string", description: "The order number, e.g. '1043'." },
      tracking_number: { type: "string", description: "Optional courier tracking number." },
    },
    required: ["order_no"],
    additionalProperties: false,
  },
  risk: "med",
  tier: "soft",

  async plan(req, ctx, args) {
    const found = await resolveOrder(req, ctx, args.order_no ?? args.order_number ?? "")
    if (!found.ok) return { ok: false, error: found.error }
    const order = found.order
    const no = orderNoOf(order)

    if (order.status === "canceled") {
      return { ok: false, error: `Order #${no} was cancelled, so it can't be fulfilled.` }
    }
    const fState = fulfillmentStatusFrom(order.fulfillments || [])
    if (["fulfilled", "shipped", "delivered"].includes(fState)) {
      return { ok: false, error: `Order #${no} has already been fulfilled.` }
    }

    const items = (order.items || [])
      .map((i: any) => ({ id: i.id, quantity: Number(i.quantity ?? 0) }))
      .filter((i: any) => i.id && i.quantity >= 1)
    if (!items.length) {
      return { ok: false, error: `Order #${no} has no items to fulfil.` }
    }
    const tracking =
      typeof args.tracking_number === "string" && args.tracking_number.trim()
        ? args.tracking_number.trim()
        : undefined

    const itemWord = items.length === 1 ? "item" : "items"
    const summary = tracking
      ? `Fulfil order #${no} (${items.length} ${itemWord}) with tracking ${tracking} and mark it ready to ship?`
      : `Fulfil order #${no} (${items.length} ${itemWord}) and mark it ready to ship?`
    return {
      ok: true,
      human_summary: summary,
      details: { order_no: no, items: items.length, tracking_number: tracking ?? null },
      apply_args: { order_id: order.id, order_no: no, items, tracking_number: tracking },
    }
  },

  async apply(req, _ctx, applyArgs) {
    const tracking = applyArgs.tracking_number
    const labels = tracking
      ? [{ tracking_number: tracking, tracking_url: "", label_url: "" }]
      : undefined
    try {
      const { result: fulfillment } = await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: applyArgs.order_id,
          items: applyArgs.items,
          labels,
          metadata: tracking ? { tracking_number: tracking } : undefined,
        },
      })
      const fulfillmentId = (fulfillment as any)?.id
      // A freshly created fulfilment has not shipped, so cancelling it is safe.
      const undo = fulfillmentId
        ? {
            action: "cancel_fulfillment",
            apply_args: { order_id: applyArgs.order_id, fulfillment_id: fulfillmentId },
          }
        : { available: false as const, reason: "The fulfilment couldn't be identified to undo." }
      return { result: fulfillment, undo }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't fulfil that order.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

/**
 * The five SOFT (low-risk, one-tap-confirm) Pixi write tools. `cancelFulfillment`
 * below is the compensating action named by fulfil_order's undo — it is NOT a
 * merchant-invokable tool, only an undo target, so it lives outside SOFT_WRITES.
 */
export const SOFT_WRITES: JarvisWrite[] = [
  makeProductSellable,
  setupDelivery,
  enablePaymentGateway,
  setProductPrice,
  fulfilOrder,
]

/**
 * Undo executor for fulfil_order — cancels a fulfilment the merchant just
 * created via its `cancel_fulfillment` undo action. Exposed so the confirm-gate
 * runtime can dispatch that action; kept out of SOFT_WRITES so the model can
 * never call it directly.
 */
export async function cancelFulfillment(
  req: MedusaRequest,
  _ctx: Ctx,
  applyArgs: Record<string, any>
): Promise<ApplyResult> {
  try {
    const { result } = await cancelOrderFulfillmentWorkflow(req.scope).run({
      input: {
        order_id: applyArgs.order_id,
        fulfillment_id: applyArgs.fulfillment_id,
      },
    })
    return { result, undo: { available: false, reason: "A cancellation can't be undone." } }
  } catch (e: any) {
    return {
      result: { ok: false, error: friendly(e, "I couldn't undo that fulfilment.") },
      undo: { available: false, reason: "Nothing was changed." },
    }
  }
}
