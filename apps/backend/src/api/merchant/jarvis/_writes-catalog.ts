import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { batchLinkProductsToCollectionWorkflow } from "@medusajs/core-flows"
import type { JarvisWrite, Ctx } from "./_writes-money"
import { namespaceCode } from "../discounts/_promo-code"

/**
 * Pixi P3 — CATALOG & OFFERS write tools.
 *
 * These give Pixi the same catalog/offer powers the merchant has in the
 * dashboard: create a product collection, create a product category, and create
 * a discount / promo code. They obey the identical decide-then-do contract as
 * `_writes-soft.ts` and `_writes-money.ts`:
 *
 *   - `plan()` NEVER mutates. It resolves the merchant's words into concrete,
 *     tenant-owned values (products by name, a parent category by name — exactly
 *     the way the read-only runtime resolves them), validates the request, and
 *     returns `{ human_summary, details, apply_args }` for the confirm card. Bad
 *     input comes back as `{ ok:false, error }` — a friendly sentence, never a
 *     stack trace.
 *   - `apply()` runs ONLY the values `plan()` produced (the model never supplies
 *     an id or the tenant) by calling the SAME module/workflow the REST route
 *     uses, and returns `{ result, undo? }`.
 *
 * TENANCY is taken from `ctx` on every path and stamped onto every created row:
 *   - collections & categories are GLOBAL in Medusa, so they are tagged with
 *     `metadata.tenant_id = ctx.tenant.id` (mirrors the collections /
 *     product-categories routes), which is how they are scoped back out.
 *   - products linked into a collection are verified to belong to this tenant's
 *     sales channel before any link is written.
 *   - a discount's real promotion `code` is tenant-namespaced (see
 *     `../discounts/_promo-code`) so it can never collide with, or be read by,
 *     another tenant; the merchant only ever sees the plain DISPLAY code.
 *
 * TIER: create_collection / create_category / add_products_to_collection are
 * SOFT (low-risk, one-tap, easily reversible from the dashboard). create_discount
 * is HARD (a discount is customer-facing and directly reduces revenue), so it
 * carries a typed `requireText` confirm, exactly like the money tools.
 */

/* ------------------------------- internals ------------------------------- */

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

const scOf = (ctx: Ctx): string | null =>
  ctx.tenant?.meta?.sales_channel_id ?? null

const CUR = (c?: string, fallback = "usd") => (c || fallback).toLowerCase()

/** Turn any thrown error into a short, merchant-safe sentence. */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  if (!msg || msg.length > 160 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

/** Slug for a collection handle — mirrors the collections route. */
function slugifyCollection(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "") || "collection"
  )
}

/** Slug for a category handle — mirrors the product-categories route. */
function slugifyCategory(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\p{Ll}\p{Lo}\p{Lm}\p{N}-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  )
}

type TenantProduct = { id: string; title: string; handle: string; status: string }

/**
 * All of this tenant's real (non-sample) products, resolved the same way the
 * read runtime does: only products linked to this store's sales channel.
 */
async function loadTenantProducts(
  req: MedusaRequest,
  ctx: Ctx
): Promise<TenantProduct[]> {
  const scId = scOf(ctx)
  if (!scId) return []
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
  if (!ids.length) return []
  const { data: products } = await query
    .graph({
      entity: "product",
      filters: { id: ids } as any,
      fields: ["id", "title", "handle", "status", "metadata"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  return (products || [])
    .filter((p: any) => !p.metadata?.is_sample)
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
    }))
}

/** Match ONE product from an already-loaded tenant list by title/handle. */
function matchProduct(
  rows: TenantProduct[],
  term: string
): { ok: true; product: TenantProduct } | { ok: false; error: string } {
  const needle = (term || "").toLowerCase().trim()
  if (!needle) return { ok: false, error: "Tell me which product, e.g. \"Blue Kaftan\"." }
  const exact = rows.filter(
    (p) => (p.title || "").toLowerCase() === needle || (p.handle || "").toLowerCase() === needle
  )
  const partial = rows.filter((p) => (p.title || "").toLowerCase().includes(needle))
  const matches = exact.length ? exact : partial
  if (!matches.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p) => `"${p.title}"`).join(", ")
    return { ok: false, error: `"${term}" matched ${matches.length} products (${names}). Which one did you mean?` }
  }
  return { ok: true, product: matches[0] }
}

/**
 * Resolve a list of free-text product names into tenant-owned product ids.
 * Returns the resolved ids + titles, or the first resolution error.
 */
async function resolveProductList(
  req: MedusaRequest,
  ctx: Ctx,
  terms: string[]
): Promise<{ ok: true; ids: string[]; titles: string[] } | { ok: false; error: string }> {
  const clean = (terms || []).map((t) => String(t ?? "").trim()).filter(Boolean)
  if (!clean.length) return { ok: true, ids: [], titles: [] }
  const rows = await loadTenantProducts(req, ctx)
  if (!rows.length) return { ok: false, error: "You don't have any products to add yet." }
  const ids: string[] = []
  const titles: string[] = []
  for (const term of clean) {
    const m = matchProduct(rows, term)
    if (!m.ok) return { ok: false, error: m.error }
    if (!ids.includes(m.product.id)) {
      ids.push(m.product.id)
      titles.push(m.product.title)
    }
  }
  return { ok: true, ids, titles }
}

type TenantCategory = {
  id: string
  name: string
  handle: string
}

/** This tenant's categories (tagged metadata.tenant_id), for parent lookups. */
async function loadTenantCategories(
  req: MedusaRequest,
  ctx: Ctx
): Promise<TenantCategory[]> {
  const query = q(req)
  const { data } = await query
    .graph({
      entity: "product_category",
      filters: { metadata: { tenant_id: ctx.tenant.id } } as any,
      fields: ["id", "name", "handle", "metadata"],
      pagination: { take: 500, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  return (data || [])
    .filter((c: any) => c.metadata?.tenant_id === ctx.tenant.id)
    .map((c: any) => ({ id: c.id, name: c.name, handle: c.handle }))
}

/* --------------------------- 1. create_collection ------------------------ */

const createCollection: JarvisWrite = {
  name: "create_collection",
  description:
    "Create a product collection (a curated group of products, e.g. 'Summer Sale' or 'New Arrivals') and optionally add products to it. Use when the merchant asks to 'make a collection', 'group these products', 'create a Summer collection'. You can name products to include; search_products first if you're unsure of the exact names.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The collection's name, e.g. 'Summer Sale'." },
      products: {
        type: "array",
        items: { type: "string", description: "A product name to add, e.g. 'Blue Kaftan'." },
        description: "Optional product names to add to the new collection.",
      },
    },
    required: ["title"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const title = String(args.title ?? "").trim()
    if (!title) return { ok: false, error: "What should the collection be called?" }

    const terms = Array.isArray(args.products) ? args.products : []
    const resolved = await resolveProductList(req, ctx, terms)
    if (!resolved.ok) return { ok: false, error: resolved.error }

    const withProducts = resolved.ids.length
      ? ` and add ${resolved.ids.length} product${resolved.ids.length === 1 ? "" : "s"} (${resolved.titles.map((t) => `"${t}"`).join(", ")})`
      : ""
    return {
      ok: true,
      human_summary: `Create a new collection "${title}"${withProducts}?`,
      details: { title, products: resolved.titles },
      apply_args: { title, handle: slugifyCollection(title), product_ids: resolved.ids },
    }
  },

  async apply(req, ctx, applyArgs) {
    try {
      const productModule: any = req.scope.resolve(Modules.PRODUCT)
      const [collection] = await productModule.createProductCollections([
        {
          title: applyArgs.title,
          handle: applyArgs.handle || slugifyCollection(String(applyArgs.title || "")),
          metadata: { tenant_id: ctx.tenant.id },
        },
      ])
      const ids: string[] = Array.isArray(applyArgs.product_ids) ? applyArgs.product_ids : []
      if (ids.length && collection?.id) {
        await batchLinkProductsToCollectionWorkflow(req.scope).run({
          input: { id: collection.id, add: ids, remove: [] },
        })
      }
      return {
        result: { ok: true, collection: { id: collection?.id, title: collection?.title }, products_added: ids.length },
        undo: { available: false, reason: "You can delete this collection from Catalog → Collections." },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't create that collection.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ----------------------- 2. add_products_to_collection ------------------- */

const addProductsToCollection: JarvisWrite = {
  name: "add_products_to_collection",
  description:
    "Add one or more existing products to an existing product collection. Use when the merchant asks to 'add <product> to <collection>', 'put these in my Summer collection'. Names both the collection and the products; search_products / list_collections first if unsure of exact names.",
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", description: "The collection's name, e.g. 'Summer Sale'." },
      products: {
        type: "array",
        items: { type: "string", description: "A product name to add, e.g. 'Blue Kaftan'." },
        description: "The product names to add to the collection.",
      },
    },
    required: ["collection", "products"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const collName = String(args.collection ?? "").trim()
    if (!collName) return { ok: false, error: "Which collection should I add them to?" }

    const productModule: any = req.scope.resolve(Modules.PRODUCT)
    const all = await productModule
      .listProductCollections({}, { take: 500, skip: 0 })
      .catch(() => [])
    const owned = (all || []).filter((c: any) => c.metadata?.tenant_id === ctx.tenant.id)
    const needle = collName.toLowerCase()
    const exact = owned.filter((c: any) => (c.title || "").toLowerCase() === needle)
    const partial = owned.filter((c: any) => (c.title || "").toLowerCase().includes(needle))
    const matches = exact.length ? exact : partial
    if (!matches.length) return { ok: false, error: `I couldn't find a collection called "${collName}".` }
    if (matches.length > 1) {
      return { ok: false, error: `"${collName}" matched ${matches.length} collections — which one did you mean?` }
    }
    const collection = matches[0]

    const terms = Array.isArray(args.products) ? args.products : []
    const resolved = await resolveProductList(req, ctx, terms)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    if (!resolved.ids.length) return { ok: false, error: "Tell me which products to add." }

    return {
      ok: true,
      human_summary: `Add ${resolved.ids.length} product${resolved.ids.length === 1 ? "" : "s"} (${resolved.titles.map((t) => `"${t}"`).join(", ")}) to collection "${collection.title}"?`,
      details: { collection: collection.title, products: resolved.titles },
      apply_args: { collection_id: collection.id, product_ids: resolved.ids },
    }
  },

  async apply(req, ctx, applyArgs) {
    const ids: string[] = Array.isArray(applyArgs.product_ids) ? applyArgs.product_ids : []
    if (!applyArgs.collection_id || !ids.length) {
      return {
        result: { ok: false, error: "There was nothing to add." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      // Re-verify the collection still belongs to this tenant before mutating.
      const productModule: any = req.scope.resolve(Modules.PRODUCT)
      const collection = await productModule
        .retrieveProductCollection(applyArgs.collection_id)
        .catch(() => null)
      if (!collection || collection.metadata?.tenant_id !== ctx.tenant.id) {
        return {
          result: { ok: false, error: "That collection is no longer available." },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }
      await batchLinkProductsToCollectionWorkflow(req.scope).run({
        input: { id: applyArgs.collection_id, add: ids, remove: [] },
      })
      return {
        result: { ok: true, collection_id: applyArgs.collection_id, products_added: ids.length },
        undo: {
          action: "remove_products_from_collection",
          apply_args: { collection_id: applyArgs.collection_id, product_ids: ids },
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't add those products.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ---------------------------- 3. create_category ------------------------- */

const createCategory: JarvisWrite = {
  name: "create_category",
  description:
    "Create a product category to organise the store's catalog (e.g. 'Shoes', 'Accessories'), optionally nested under a parent category. Use when the merchant asks to 'add a category', 'create a Shoes category', 'make a sub-category under Clothing'.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The category's name, e.g. 'Shoes'." },
      parent: {
        type: "string",
        description: "Optional parent category name to nest this under, e.g. 'Clothing'.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const name = String(args.name ?? "").trim()
    if (!name) return { ok: false, error: "What should the category be called?" }

    let parentId: string | undefined
    let parentName: string | undefined
    const parentTerm = String(args.parent ?? "").trim()
    if (parentTerm) {
      const cats = await loadTenantCategories(req, ctx)
      const needle = parentTerm.toLowerCase()
      const exact = cats.filter((c) => (c.name || "").toLowerCase() === needle)
      const partial = cats.filter((c) => (c.name || "").toLowerCase().includes(needle))
      const matches = exact.length ? exact : partial
      if (!matches.length) return { ok: false, error: `I couldn't find a parent category called "${parentTerm}".` }
      if (matches.length > 1) {
        return { ok: false, error: `"${parentTerm}" matched ${matches.length} categories — which parent did you mean?` }
      }
      parentId = matches[0].id
      parentName = matches[0].name
    }

    return {
      ok: true,
      human_summary: parentName
        ? `Create category "${name}" under "${parentName}"?`
        : `Create category "${name}"?`,
      details: { name, parent: parentName ?? null },
      apply_args: { name, handle: slugifyCategory(name), parent_id: parentId ?? null },
    }
  },

  async apply(req, ctx, applyArgs) {
    try {
      const productModule: any = req.scope.resolve(Modules.PRODUCT)
      const [category] = await productModule.createProductCategories([
        {
          name: applyArgs.name,
          handle: applyArgs.handle || slugifyCategory(String(applyArgs.name || "")),
          parent_category_id: applyArgs.parent_id || undefined,
          is_active: true,
          is_internal: false,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ])
      return {
        result: { ok: true, category: { id: category?.id, name: category?.name } },
        undo: { available: false, reason: "You can delete this category from Catalog → Categories." },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't create that category.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ---------------------------- 4. create_discount ------------------------- */

// applies_to (Pixi wording) -> the promotion target_type the module expects.
const TARGET_BY_APPLIES: Record<string, "order" | "items" | "shipping_methods"> = {
  order: "order",
  items: "items",
  shipping: "shipping_methods",
  shipping_methods: "shipping_methods",
}

/**
 * Build the promotion application_method from validated args — mirrors the
 * `/merchant/discounts` route's buildApplicationMethod (percentage / fixed only).
 */
function buildApplicationMethod(
  type: "percentage" | "fixed",
  value: number,
  targetType: "order" | "items" | "shipping_methods",
  currency: string
) {
  return {
    type,
    target_type: targetType,
    value,
    allocation: type === "fixed" && targetType === "items" ? "across" : undefined,
    currency_code: type === "fixed" ? currency : undefined,
  }
}

const createDiscount: JarvisWrite = {
  name: "create_discount",
  description:
    "Create a discount / promo code customers enter at checkout (a percentage off, or a fixed amount off). Use when the merchant asks to 'set up a coupon', 'create a discount code', 'make a 20% off code', 'run a sale code'. Supports an optional usage limit, expiry date, and what it applies to (whole order, items, or shipping). This creates a LIVE, customer-facing code that reduces revenue, so it needs confirmation.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "The code customers type, e.g. 'SUMMER20'." },
      type: {
        type: "string",
        enum: ["percentage", "fixed"],
        description: "'percentage' for a percent off, 'fixed' for a fixed amount off.",
      },
      value: {
        type: "number",
        description: "The amount off: a percent (1-100) for percentage, or a whole-unit amount for fixed.",
      },
      usage_limit: {
        type: "number",
        description: "Optional maximum number of times the code can be used in total.",
      },
      expires_at: {
        type: "string",
        description: "Optional expiry date (ISO date, e.g. '2026-12-31'). Omit for no expiry.",
      },
      applies_to: {
        type: "string",
        enum: ["order", "items", "shipping"],
        description: "What the discount applies to: the whole order (default), items, or shipping.",
      },
      currency_code: {
        type: "string",
        description: "3-letter currency for a fixed discount; defaults to your store currency.",
      },
    },
    required: ["code", "type", "value"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "CREATE",

  async plan(req, ctx, args) {
    const displayCode = String(args.code ?? "").trim()
    if (!displayCode) return { ok: false, error: "What should the discount code be, e.g. 'SUMMER20'?" }
    if (displayCode.length > 100) return { ok: false, error: "That discount code is too long." }

    const type = args.type === "fixed" ? "fixed" : args.type === "percentage" ? "percentage" : null
    if (!type) return { ok: false, error: "Should the discount be a percentage off or a fixed amount off?" }

    let value = Number(args.value)
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, error: "Give me a discount amount greater than zero." }
    }
    if (type === "percentage" && value > 100) {
      return { ok: false, error: "A percentage discount can't be more than 100%." }
    }
    // The promotion model stores value as a whole number (route uses int).
    value = Math.round(value)

    const targetType = TARGET_BY_APPLIES[String(args.applies_to ?? "order")] ?? "order"
    const currency = CUR(args.currency_code || ctx.tenant?.meta?.currency_code)

    const internalCode = namespaceCode(ctx.tenant.id, displayCode)

    // Per-tenant uniqueness: the namespaced code embeds this tenant's id, so an
    // existing row with the same internal code can only be THIS tenant's.
    const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
    const clash = await promotionModule
      .listPromotions({ code: internalCode }, { take: 1 })
      .catch(() => [])
    if ((clash || []).some((p: any) => p.code === internalCode)) {
      return { ok: false, error: `You already have a discount code "${displayCode}".` }
    }

    const expiresIso = (() => {
      const raw = String(args.expires_at ?? "").trim()
      if (!raw) return null
      const d = new Date(raw)
      if (isNaN(d.getTime())) return { error: "I couldn't read that expiry date — try something like 2026-12-31." }
      return d.toISOString()
    })()
    if (expiresIso && typeof expiresIso === "object") return { ok: false, error: expiresIso.error }

    let usageLimit: number | null = null
    if (args.usage_limit != null) {
      const n = Math.floor(Number(args.usage_limit))
      if (!Number.isFinite(n) || n < 1) {
        return { ok: false, error: "The usage limit has to be a whole number of 1 or more." }
      }
      usageLimit = n
    }

    // Human-readable summary pieces.
    const valueLabel =
      type === "percentage" ? `${value}% off` : `${currency.toUpperCase()} ${value} off`
    const targetLabel =
      targetType === "shipping_methods"
        ? " on shipping"
        : targetType === "items"
        ? " on eligible items"
        : ""
    const usesLabel = usageLimit ? `up to ${usageLimit} use${usageLimit === 1 ? "" : "s"}` : "unlimited uses"
    const expiryLabel = expiresIso
      ? `expiring ${String(expiresIso).slice(0, 10)}`
      : "no expiry"

    const applicationMethod = buildApplicationMethod(type, value, targetType, currency)

    return {
      ok: true,
      human_summary: `Create a live ${valueLabel} discount code "${displayCode}"${targetLabel} — ${usesLabel}, ${expiryLabel}. Customers can use it at checkout right away.`,
      details: {
        code: displayCode,
        type,
        value,
        applies_to: targetType,
        currency: type === "fixed" ? currency.toUpperCase() : null,
        usage_limit: usageLimit,
        expires_at: expiresIso ?? null,
      },
      apply_args: {
        code: internalCode,
        display_code: displayCode,
        status: "active",
        limit: usageLimit,
        expires_at: expiresIso ?? null,
        application_method: applicationMethod,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
    // Backstop clash re-check against the frozen namespaced code (also protects
    // against a race between plan() and apply()).
    const clash = await promotionModule
      .listPromotions({ code: applyArgs.code }, { take: 1 })
      .catch(() => [])
    if ((clash || []).some((p: any) => p.code === applyArgs.code)) {
      return {
        result: { ok: false, error: `You already have a discount code "${applyArgs.display_code}".` },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      const [promotion] = await promotionModule.createPromotions([
        {
          code: applyArgs.code,
          type: "standard",
          status: applyArgs.status || "active",
          is_automatic: false,
          limit: applyArgs.limit ?? null,
          expires_at: applyArgs.expires_at || undefined,
          application_method: applyArgs.application_method,
          metadata: { tenant_id: ctx.tenant.id, display_code: applyArgs.display_code },
        },
      ])
      return {
        result: { ok: true, code: applyArgs.display_code, id: promotion?.id, status: promotion?.status },
        undo: {
          available: false,
          reason: "You can deactivate or delete this code from Catalog → Discounts.",
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't create that discount.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

/**
 * Catalog & offers write tools. create_collection / create_category /
 * add_products_to_collection are SOFT (one-tap); create_discount is HARD (typed
 * confirm) because it publishes a live, revenue-reducing, customer-facing code.
 */
export const CATALOG_WRITES: JarvisWrite[] = [
  createCollection,
  addProductsToCollection,
  createCategory,
  createDiscount,
]
