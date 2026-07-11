import { HttpTypes } from "@medusajs/types"

import { listProducts, listProductsWithSort } from "@lib/data/products"

/* ------------------------------------------------------------------ */
/* Shared, server-only fetch logic for the product_tabs block.          */
/*                                                                      */
/* Extracted so BOTH the live async server block (ProductTabs.tsx) and   */
/* the visual-editor bridge (/api/puck/products) resolve tab products    */
/* through the EXACT same code — no drift between what the editor        */
/* previews and what the storefront ships. Server-only (imports          */
/* lib/data/products, which touches cookies/headers).                    */
/* ------------------------------------------------------------------ */

export type ProductTabSource = "all" | "category" | "collection" | "manual"

export type ProductTabSort = "created_at" | "price_asc" | "price_desc"

export interface ProductTab {
  label: string
  source: ProductTabSource
  category_id?: string
  collection_id?: string
  product_ids?: string[]
  sort?: ProductTabSort
  limit?: number
}

export const DEFAULT_COUNTRY = process.env.NEXT_PUBLIC_DEFAULT_REGION || "bd"
const DEFAULT_LIMIT = 10
const FIELDS =
  "*variants.calculated_price,*images,thumbnail,handle,title,*categories"

const EMPTY = { response: { products: [], count: 0 } } as {
  response: { products: HttpTypes.StoreProduct[]; count: number }
}

/** Fetch the live products for a single tab, honouring its source binding. */
export async function fetchTabProducts(
  tab: ProductTab | undefined,
  countryCode: string
): Promise<HttpTypes.StoreProduct[]> {
  if (!tab) {
    return []
  }

  const limit =
    typeof tab.limit === "number" && isFinite(tab.limit) && tab.limit > 0
      ? Math.floor(tab.limit)
      : DEFAULT_LIMIT

  // Hand-picked products: fetch by id, preserve the configured order, and drop
  // any id that no longer resolves to a product (dangling-ref safe).
  if (tab.source === "manual") {
    const ids = Array.isArray(tab.product_ids)
      ? tab.product_ids.filter(Boolean)
      : []
    if (!ids.length) {
      return []
    }
    const { response } = await listProducts({
      countryCode,
      queryParams: { id: ids, limit: ids.length, fields: FIELDS } as any,
    }).catch(() => EMPTY)
    const byId = new Map(response.products.map((p) => [p.id, p]))
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is HttpTypes.StoreProduct => !!p)
      .slice(0, limit)
  }

  const queryParams: Record<string, unknown> = { limit, fields: FIELDS }

  // Category / collection sources REQUIRE a bound id. A missing binding is a
  // dangling reference — skip the tab rather than dumping the whole catalogue.
  if (tab.source === "category") {
    if (!tab.category_id) {
      return []
    }
    queryParams.category_id = [tab.category_id]
  } else if (tab.source === "collection") {
    if (!tab.collection_id) {
      return []
    }
    queryParams.collection_id = [tab.collection_id]
  }

  const sortBy: ProductTabSort =
    tab.sort === "price_asc" || tab.sort === "price_desc"
      ? tab.sort
      : "created_at"

  // page = 1 → pageParam 0 → the helper sorts then returns the first `limit`.
  const { response } = await listProductsWithSort({
    page: 1,
    countryCode,
    sortBy,
    queryParams: queryParams as any,
  }).catch(() => EMPTY)

  return response.products.slice(0, limit)
}

/** One resolved tab: its authored label + the live products bound to it. */
export interface ProductTabGroup {
  label: string
  products: HttpTypes.StoreProduct[]
}

/**
 * Resolve every configured tab's live products, aligned 1:1 with `tabs` (NOT
 * filtered — callers that only want non-empty groups filter themselves; the
 * fixed-slot themes index into it). Shared by the theme-aware live blocks and
 * the editor preview bridge (/api/puck/product-tab-groups) so both resolve tab
 * products through the EXACT same code — no drift between preview and live.
 */
export async function fetchTabGroups(
  tabs: ProductTab[],
  countryCode: string
): Promise<ProductTabGroup[]> {
  const results = await Promise.all(
    tabs.map((tab) => fetchTabProducts(tab, countryCode))
  )
  return tabs.map((tab, i) => ({
    label: tab.label || "",
    products: results[i],
  }))
}

/**
 * Resolve the three Learts tab slots (new / sale / best) from the first three
 * configured tabs, fetched in parallel. Shared by the live block and the editor
 * preview bridge.
 */
export async function fetchTabSlots(
  tabs: ProductTab[],
  countryCode: string
): Promise<{
  newArrivals: HttpTypes.StoreProduct[]
  saleItems: HttpTypes.StoreProduct[]
  bestSellers: HttpTypes.StoreProduct[]
}> {
  const [newArrivals, saleItems, bestSellers] = await Promise.all([
    fetchTabProducts(tabs[0], countryCode),
    fetchTabProducts(tabs[1], countryCode),
    fetchTabProducts(tabs[2], countryCode),
  ])
  return { newArrivals, saleItems, bestSellers }
}
