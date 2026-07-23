import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/core-flows"
import {
  getAvailableByVariant,
  getVariantInventoryLinks,
  getOrCreateDefaultLocation,
} from "../_inventory"

/**
 * Pixi P1 — EXTRA SOFT WRITE tools (sibling of _writes-soft.ts).
 *
 * Two more one-tap-confirm actions that follow the exact same wall between
 * deciding and doing as the other soft writes:
 *
 *   - `plan()` NEVER mutates. It validates the request and resolves the human's
 *     words into concrete, tenant-owned ids the same way the read-only runtime
 *     does (a product by its title, samples excluded), then returns
 *     `{ human_summary, details, apply_args }` for the confirm card. Bad input
 *     comes back as `{ ok:false, error }` — a friendly sentence, never a trace.
 *   - `apply()` runs ONLY what `plan()` produced by calling the same core-flows
 *     workflow the REST routes use (createProductsWorkflow for the product,
 *     create/updateInventoryLevelsWorkflow for stock), and returns
 *     `{ result, undo? }`.
 *
 * Tenancy is taken from `ctx` on every path (`ctx.tenant.meta.sales_channel_id`
 * for the catalog, `ctx.tenant.id` for the namespace stamp) — the model never
 * supplies an id or a tenant, and a lookup that misses the tenant's sales
 * channel simply returns "not found". Nothing here leaks an internal error.
 *
 * Undo model: `create_product` is not symmetric, so its undo names a hidden
 * `delete_product` action carrying the fresh product id (wired by the registry
 * combiner to `deleteProduct` below, exactly like fulfil_order ->
 * cancel_fulfillment). `restock_variant` self-reverses to the previous stock
 * ONLY when every variant had the same quantity before; if the variants
 * differed, there is no single value to revert to, so it declares no undo.
 */

/* ------------------------------- shared types ---------------------------- */
// Copied VERBATIM from _writes-soft.ts so this sibling concatenates cleanly.

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

function slugifyHandle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "") || "product"
}

/**
 * All tenant-owned, non-sample products (id/title/status/variants), reached
 * ONLY through this store's sales channel — the exact scoping the P0 runtime and
 * the /merchant product routes use, so cross-tenant rows are never visible.
 */
async function tenantProducts(
  req: MedusaRequest,
  ctx: Ctx
): Promise<{ id: string; title: string; status: string; variants: any[] }[]> {
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
      fields: ["id", "title", "status", "metadata", "variants.id", "variants.title"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))

  return (products || [])
    .filter((p: any) => !p.metadata?.is_sample)
    .map((p: any) => ({ id: p.id, title: p.title, status: p.status, variants: p.variants || [] }))
}

/**
 * Resolve ONE tenant-owned product from a free-text query, the same way P0's
 * search_products (and _writes-soft.ts) does: only products linked to this
 * store's sales channel, the provisioned SAMPLE never a match. Prefers an exact
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
  if (!needle) return { ok: false, error: "Tell me which product, e.g. \"Watch\"." }

  const rows = await tenantProducts(req, ctx)
  if (!rows.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }

  const exact = rows.filter((p) => (p.title || "").toLowerCase() === needle)
  const partial = rows.filter((p) => (p.title || "").toLowerCase().includes(needle))
  const matches = exact.length ? exact : partial

  if (!matches.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p) => `"${p.title}"`).join(", ")
    return {
      ok: false,
      error: `That matched ${matches.length} products (${names}). Which one did you mean?`,
    }
  }
  return { ok: true, product: matches[0] }
}

/** The tenant's shared default shipping profile — without one, checkout fails. */
async function defaultShippingProfileId(req: MedusaRequest): Promise<string | undefined> {
  const query = q(req)
  const { data } = await query
    .graph({
      entity: "shipping_profile",
      filters: { type: "default" } as any,
      fields: ["id"],
      pagination: { take: 1, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  return data?.[0]?.id
}

/* ----------------------------- 1. create_product ------------------------- */

const createProductTool: JarvisWrite = {
  name: "create_product",
  description:
    "Create a brand-new product in the store and publish it so customers can buy it. Use for 'add a product called Blue Kaftan for 1500', 'create the Watch at $49 and publish it'. Takes a title and a price.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The product's name, e.g. 'Blue Kaftan'." },
      price: { type: "number", description: "The selling price in your store currency, e.g. 1500." },
      description: { type: "string", description: "Optional short product description." },
    },
    required: ["title", "price"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const scId = scOf(ctx)
    if (!scId) return { ok: false, error: "Your store isn't fully set up yet." }

    const title = String(args.title ?? "").trim()
    if (!title) return { ok: false, error: "Give the product a name, e.g. \"Blue Kaftan\"." }

    const price = Number(args.price)
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: "Give me a valid price above 0, e.g. 1500." }
    }

    // Refuse a duplicate: never create a second product with the same exact
    // title in this store (tenant-scoped, case-insensitive).
    const rows = await tenantProducts(req, ctx)
    const clash = rows.find((p) => (p.title || "").toLowerCase() === title.toLowerCase())
    if (clash) {
      return { ok: false, error: `You already have a product called "${clash.title}".` }
    }

    const description =
      typeof args.description === "string" && args.description.trim()
        ? args.description.trim()
        : undefined
    const currency = CUR(ctx.tenant?.meta?.currency_code)
    const cur = currency.toUpperCase()
    return {
      ok: true,
      human_summary: `Create the product "${title}" at ${cur} ${price} and publish it?`,
      details: { title, price: `${cur} ${price}`, status: "published" },
      apply_args: {
        title,
        description,
        price,
        currency_code: currency,
        sales_channel_id: scId,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const title = String(applyArgs.title ?? "").trim()
    const price = Number(applyArgs.price)
    const currency = CUR(applyArgs.currency_code || ctx.tenant?.meta?.currency_code)
    const scId = String(applyArgs.sales_channel_id ?? scOf(ctx) ?? "")
    if (!title || !Number.isFinite(price) || !scId) {
      return {
        result: { ok: false, error: "I didn't have enough to create that product." },
        undo: { available: false, reason: "Nothing was created." },
      }
    }

    try {
      const shippingProfileId = await defaultShippingProfileId(req)
      const productInput: any = {
        title,
        handle: slugifyHandle(title),
        status: "published",
        sales_channels: [{ id: scId }],
        shipping_profile_id: shippingProfileId,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            prices: [{ currency_code: currency, amount: price }],
            options: { Default: "Default" },
            manage_inventory: true,
            allow_backorder: false,
          },
        ],
      }
      if (applyArgs.description) productInput.description = applyArgs.description
      // TENANT NAMESPACE STAMP: handles/SKUs are unique PER STORE, so the product
      // and every variant row must carry its owner (forced, never client-spoofed).
      productInput.metadata = { tenant_id: ctx.tenant.id }
      productInput.variants = productInput.variants.map((v: any) => ({
        ...v,
        metadata: { tenant_id: ctx.tenant.id },
      }))

      const { result: products } = await createProductsWorkflow(req.scope).run({
        input: { products: [productInput] },
      })
      const product = (products as any[])[0]
      if (!product?.id) {
        return {
          result: { ok: false, error: "The product couldn't be created." },
          undo: { available: false, reason: "Nothing was created." },
        }
      }

      // Stamp the freshly-created inventory items with the tenant namespace so
      // two stores can't collide in the legacy ('') bucket before the repair
      // sweep runs. Best-effort — the 5-minute sweep is the backstop.
      try {
        const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
        await pg.raw(
          `UPDATE inventory_item ii
           SET metadata = coalesce(ii.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', ?::text)
           FROM product_variant_inventory_item pvii
           JOIN product_variant v ON v.id = pvii.variant_id
           WHERE pvii.inventory_item_id = ii.id
             AND v.product_id = ?
             AND (ii.metadata->>'tenant_id') IS NULL`,
          [ctx.tenant.id, product.id]
        )
      } catch {
        /* the tenant-stamp-repair sweep is the backstop */
      }

      return {
        result: { product_id: product.id, title: product.title ?? title },
        undo: { action: "delete_product", apply_args: { product_id: product.id } },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't create that product.") },
        undo: { available: false, reason: "Nothing was created." },
      }
    }
  },
}

/* ---------------------------- 2. restock_variant ------------------------- */

/** Available quantity per variant, in the same shape getAvailableByVariant returns. */
async function captureAvailable(
  req: MedusaRequest,
  variantIds: string[]
): Promise<Record<string, number>> {
  if (!variantIds.length) return {}
  try {
    return await getAvailableByVariant(req, variantIds)
  } catch {
    return {}
  }
}

const restockVariantTool: JarvisWrite = {
  name: "restock_variant",
  description:
    "Set the stock level of a product (all of its variants) to an exact quantity. Use for 'set the Watch stock to 50', 'restock the Blue Kaftan to 100', 'mark <product> out of stock'. Takes a product name and a quantity.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: "The product's name, e.g. 'Watch'." },
      quantity: { type: "number", description: "The new stock level (0 or more), e.g. 50." },
    },
    required: ["product_query", "quantity"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const quantity = Number(args.quantity)
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      return { ok: false, error: "Give me a whole stock quantity of 0 or more, e.g. 50." }
    }
    const found = await resolveProduct(req, ctx, String(args.product_query ?? ""))
    if (!found.ok) return { ok: false, error: found.error }
    const p = found.product

    const variantIds = (p.variants || []).map((v: any) => v.id).filter(Boolean)
    if (!variantIds.length) {
      return { ok: false, error: `"${p.title}" has no variants to stock yet.` }
    }
    // Only variants that actually track inventory can be restocked.
    const { variantToItem } = await getVariantInventoryLinks(req, variantIds)
    const managed = variantIds.filter((id: string) => variantToItem[id])
    if (!managed.length) {
      return { ok: false, error: `"${p.title}" doesn't track stock, so there's nothing to set.` }
    }

    // Capture the CURRENT available per variant so the change can be undone.
    const before = await captureAvailable(req, managed)

    const summary =
      managed.length === 1
        ? `Set stock of "${p.title}" to ${quantity}?`
        : `Set stock of all ${managed.length} variants of "${p.title}" to ${quantity}?`
    return {
      ok: true,
      human_summary: summary,
      details: { product: p.title, variants: managed.length, quantity },
      apply_args: {
        product_query: p.title,
        quantity,
        previous_available: managed.map((id: string) => before[id] ?? 0),
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const quantity = Number(applyArgs.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      return {
        result: { ok: false, error: "That stock quantity wasn't valid." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }

    try {
      const found = await resolveProduct(req, ctx, String(applyArgs.product_query ?? ""))
      if (!found.ok) {
        return {
          result: { ok: false, error: found.error },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }
      const p = found.product
      const variantIds = (p.variants || []).map((v: any) => v.id).filter(Boolean)
      const { variantToItem } = await getVariantInventoryLinks(req, variantIds)
      const managed = variantIds.filter((id: string) => variantToItem[id])
      if (!managed.length) {
        return {
          result: { ok: false, error: `"${p.title}" doesn't track stock.` },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }

      const locationId = await getOrCreateDefaultLocation(req, ctx as any)
      if (!locationId) {
        return {
          result: { ok: false, error: "I couldn't find a place to hold your stock." },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }

      // Re-read the true "before" at apply time (also covers the undo re-invoke,
      // whose apply_args carry only { product_query, quantity }). Falls back to
      // the plan-captured values when present.
      const beforeMap = await captureAvailable(req, managed)
      const previous: number[] = Array.isArray(applyArgs.previous_available)
        ? applyArgs.previous_available.map((n: any) => Number(n) || 0)
        : managed.map((id: string) => beforeMap[id] ?? 0)

      // Split each managed variant's level at the default location into
      // create (no level yet) vs update (level exists) — the SAME workflows the
      // stock editor route uses.
      const itemIds = managed.map((id: string) => variantToItem[id])
      const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
      const existingLevels = await inventoryModule.listInventoryLevels(
        { inventory_item_id: itemIds, location_id: locationId },
        { take: 10000 }
      )
      const existingItems = new Set(
        (existingLevels || []).map((l: any) => l.inventory_item_id)
      )

      const toCreate: any[] = []
      const toUpdate: any[] = []
      for (const itemId of itemIds) {
        const payload = {
          inventory_item_id: itemId,
          location_id: locationId,
          stocked_quantity: quantity,
        }
        if (existingItems.has(itemId)) toUpdate.push(payload)
        else toCreate.push(payload)
      }

      if (toCreate.length) {
        await createInventoryLevelsWorkflow(req.scope).run({
          input: { inventory_levels: toCreate },
        })
      }
      if (toUpdate.length) {
        await updateInventoryLevelsWorkflow(req.scope).run({
          input: { updates: toUpdate },
        })
      }

      // Self-reverse only when every variant had the SAME quantity before; if
      // they differed there's no single value to revert to.
      const uniform = previous.length > 0 && previous.every((v) => v === previous[0])
      const undo = uniform
        ? {
            action: "restock_variant",
            apply_args: { product_query: p.title, quantity: previous[0] },
          }
        : {
            available: false as const,
            reason: "stock was different per variant",
          }

      return {
        result: { ok: true, product: p.title, variants: managed.length, quantity },
        undo,
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't update that stock.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

/**
 * The EXTRA soft (low-risk, one-tap-confirm) Pixi write tools. `deleteProduct`
 * below is the compensating action named by create_product's undo — it is NOT a
 * merchant-invokable tool, only an undo target, so it lives OUTSIDE EXTRA_WRITES
 * (mirrors cancel_fulfillment in _writes-soft.ts).
 */
export const EXTRA_WRITES: JarvisWrite[] = [createProductTool, restockVariantTool]

/**
 * Undo executor for create_product — soft-deletes a product the merchant just
 * created via its `delete_product` undo action (the SAME soft-delete the
 * /merchant/products/[id] DELETE route uses). Exposed so the confirm-gate
 * runtime can dispatch that action; kept out of EXTRA_WRITES so the model can
 * never call it directly. Tenant-guarded: refuses any product outside this
 * store's sales channel.
 */
export async function deleteProduct(
  req: MedusaRequest,
  ctx: Ctx,
  applyArgs: Record<string, any>
): Promise<ApplyResult> {
  const productId = String(applyArgs.product_id ?? "")
  if (!productId) {
    return {
      result: { ok: false, error: "There was nothing to remove." },
      undo: { available: false, reason: "Nothing was changed." },
    }
  }
  const scId = scOf(ctx)
  if (!scId) {
    return {
      result: { ok: false, error: "Your store isn't fully set up yet." },
      undo: { available: false, reason: "Nothing was changed." },
    }
  }
  try {
    // Tenant guard: the product must be linked to THIS store's sales channel.
    const query = q(req)
    const { data: links } = await query
      .graph({
        entity: "product_sales_channel",
        filters: { sales_channel_id: scId, product_id: productId } as any,
        fields: ["product_id"],
      })
      .catch(() => ({ data: [] as any[] }))
    if (!(links || []).length) {
      return {
        result: { ok: false, error: "That product isn't in your store." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }

    const productModule: any = req.scope.resolve(Modules.PRODUCT)
    await productModule.softDeleteProducts([productId])
    return {
      result: { ok: true, deleted: productId },
      undo: { available: false, reason: "Removing a product can't be undone." },
    }
  } catch (e: any) {
    return {
      result: { ok: false, error: friendly(e, "I couldn't remove that product.") },
      undo: { available: false, reason: "Nothing was changed." },
    }
  }
}
