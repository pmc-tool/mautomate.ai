import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { denamespaceCode } from "../discounts/_promo-code"

/**
 * Pixi P3 — CATALOG & OFFERS read-only tools.
 *
 * Same contract as `_tools.ts` / `_tools-more.ts`: every handler is tenant-scoped
 * through `ctx` (the tenant is NEVER read from the model's arguments) and NEVER
 * throws — a failure returns `{ error }` the model can read and explain, so a
 * broken tool degrades the answer instead of breaking the run. These let Pixi
 * SEE the catalog structure it can also create (collections, categories,
 * discounts) so it can answer "what collections do I have", "list my discount
 * codes", and avoid creating duplicates.
 *
 * Scoping mirrors the REST routes exactly:
 *   - collections & categories are GLOBAL in Medusa, tagged metadata.tenant_id at
 *     creation, so only rows carrying THIS tenant's id are returned (fail-closed;
 *     untagged/foreign rows are invisible).
 *   - discounts are promotions, also tagged metadata.tenant_id; codes are shown as
 *     the plain DISPLAY code, never the tenant-namespaced internal code.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const q = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.QUERY)

/* ----------------------------- list collections -------------------------- */

/** This tenant's product collections. */
export async function listCollections(req: MedusaRequest, ctx: Ctx) {
  try {
    const productModule: any = req.scope.resolve(Modules.PRODUCT)
    const all = await productModule
      .listProductCollections({}, { take: 500, skip: 0 })
      .catch(() => [])
    const owned = (all || []).filter((c: any) => c.metadata?.tenant_id === ctx.tenant.id)
    return {
      count: owned.length,
      collections: owned.map((c: any) => ({ title: c.title, handle: c.handle })),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read collections" }
  }
}

/* ------------------------------ list categories -------------------------- */

/** This tenant's product categories (flat list with parent + status). */
export async function listCategories(req: MedusaRequest, ctx: Ctx) {
  try {
    const query = q(req)
    const { data } = await query
      .graph({
        entity: "product_category",
        filters: { metadata: { tenant_id: ctx.tenant.id } } as any,
        fields: [
          "id",
          "name",
          "handle",
          "is_active",
          "is_internal",
          "metadata",
          "parent_category.name",
        ],
        pagination: { take: 500, skip: 0 } as any,
      })
      .catch(() => ({ data: [] as any[] }))
    const owned = (data || []).filter((c: any) => c.metadata?.tenant_id === ctx.tenant.id)
    return {
      count: owned.length,
      categories: owned.map((c: any) => ({
        name: c.name,
        handle: c.handle,
        status: c.is_active ? "active" : "inactive",
        visibility: c.is_internal ? "internal" : "public",
        parent: c.parent_category?.name ?? null,
      })),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read categories" }
  }
}

/* ------------------------------ list discounts --------------------------- */

/** This tenant's discount / promo codes, shown by their plain DISPLAY code. */
export async function listDiscounts(req: MedusaRequest, ctx: Ctx) {
  try {
    const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
    const all = await promotionModule
      .listPromotions(
        {},
        {
          take: 200,
          skip: 0,
          order: { created_at: "DESC" },
          relations: ["application_method"],
        }
      )
      .catch(() => [])
    const owned = (all || []).filter((p: any) => p.metadata?.tenant_id === ctx.tenant.id)
    return {
      count: owned.length,
      discounts: owned.map((p: any) => {
        const method = p.application_method || {}
        let type: string = method.type || "percentage"
        if (
          method.type === "percentage" &&
          method.target_type === "shipping_methods" &&
          method.value === 100
        ) {
          type = "free_shipping"
        }
        return {
          code: p.metadata?.display_code ?? denamespaceCode(ctx.tenant.id, p.code),
          type,
          value: method.value ?? 0,
          currency: (method.currency_code ?? null) || null,
          applies_to: method.target_type ?? "order",
          status: p.status,
          usage_limit: p.limit ?? null,
          usage_count: p.used ?? 0,
          expires_at: p.expires_at ?? null,
        }
      }),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read discounts" }
  }
}

/* -------------------------------- registry ------------------------------- */

export const CATALOG_READ_DEFS: AiToolDefinition[] = [
  {
    name: "list_collections",
    description:
      "List the store's product collections (curated groups of products) with their names. Use for 'what collections do I have', 'show my collections', or before creating one to avoid duplicates.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_categories",
    description:
      "List the store's product categories (how the catalog is organised), including each category's parent, status and visibility. Use for 'what categories do I have', 'show my categories', or before creating one.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_discounts",
    description:
      "List the store's discount / promo codes with their type, amount, status, usage and expiry. Use for 'what discount codes do I have', 'show my coupons', 'is SUMMER20 already a code', or before creating a new discount.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const CATALOG_READ_LABELS: Record<string, string> = {
  list_collections: "Looking up your collections",
  list_categories: "Looking up your categories",
  list_discounts: "Looking up your discount codes",
}

/** Dispatch one catalog read tool call → its JSON-serialisable result. Never throws. */
export async function runCatalogRead(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  _args: Record<string, any>
): Promise<unknown> {
  try {
    switch (name) {
      case "list_collections":
        return await listCollections(req, ctx)
      case "list_categories":
        return await listCategories(req, ctx)
      case "list_discounts":
        return await listDiscounts(req, ctx)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
