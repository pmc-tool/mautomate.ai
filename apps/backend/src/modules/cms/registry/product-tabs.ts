import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * product_tabs — tabbed product grids (refactor of the storefront
 * `home/components/learts/product-tabs.tsx`). Each tab pulls a LIVE set of
 * products from the store; the storefront renderer is a SERVER component that
 * fetches per-tab and degrades gracefully when a referenced category /
 * collection / product no longer exists (dangling-ref safe).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     tabs: Array<{
 *       label: string        ·i18n        // tab button text ("New arrivals")
 *       source: "all" | "category" | "collection" | "manual"
 *       category_id?: string              // locale-invariant — when source="category"
 *       collection_id?: string            // locale-invariant — when source="collection"
 *       product_ids?: string[]            // locale-invariant — when source="manual"
 *       sort?: "created_at" | "price_asc" | "price_desc"   // locale-invariant
 *       limit?: number                    // locale-invariant — max products (default 10)
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). Everything else is
 * locale-invariant structure / data binding. `source` decides which binding key
 * is read:
 *   - "all"        → no binding; latest products of the store
 *   - "category"   → `category_id` (required)
 *   - "collection" → `collection_id` (required)
 *   - "manual"     → `product_ids` (explicit, ordered list)
 */

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

export interface ProductTabsData {
  tabs: ProductTab[]
}

export const PRODUCT_TABS_SCHEMA_VERSION = 1

const SOURCES: ProductTabSource[] = ["all", "category", "collection", "manual"]
const SORTS: ProductTabSort[] = ["created_at", "price_asc", "price_desc"]

export const productTabsBlock: BlockDefinition<ProductTabsData> = {
  type: "product_tabs",
  label: "Product Tabs",
  schemaVersion: PRODUCT_TABS_SCHEMA_VERSION,
  defaultData: (): ProductTabsData => ({
    tabs: [
      {
        label: "New arrivals",
        source: "all",
        sort: "created_at",
        limit: 10,
      },
      {
        label: "Sale items",
        source: "all",
        sort: "created_at",
        limit: 10,
      },
      {
        label: "Best sellers",
        source: "all",
        sort: "price_desc",
        limit: 10,
      },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["product_tabs: data must be an object"])
    }

    if (!Array.isArray(data.tabs)) {
      errors.push("product_tabs: tabs must be an array")
      return ok(errors)
    }

    data.tabs.forEach((tab, i) => {
      if (!isObj(tab)) {
        errors.push(`product_tabs: tabs[${i}] must be an object`)
        return
      }

      if (!isNonEmptyStr(tab.label)) {
        errors.push(`product_tabs: tabs[${i}].label is required`)
      }

      if (!isStr(tab.source) || !SOURCES.includes(tab.source as ProductTabSource)) {
        errors.push(
          `product_tabs: tabs[${i}].source must be one of ${SOURCES.join(", ")}`
        )
      }

      if (tab.source === "category" && !isNonEmptyStr(tab.category_id)) {
        errors.push(
          `product_tabs: tabs[${i}].category_id is required when source is "category"`
        )
      }

      if (tab.source === "collection" && !isNonEmptyStr(tab.collection_id)) {
        errors.push(
          `product_tabs: tabs[${i}].collection_id is required when source is "collection"`
        )
      }

      if (tab.source === "manual") {
        if (!Array.isArray(tab.product_ids)) {
          errors.push(
            `product_tabs: tabs[${i}].product_ids must be an array when source is "manual"`
          )
        } else if (!tab.product_ids.every((id) => isNonEmptyStr(id))) {
          errors.push(
            `product_tabs: tabs[${i}].product_ids must contain only non-empty strings`
          )
        }
      }

      if (
        tab.sort !== undefined &&
        (!isStr(tab.sort) || !SORTS.includes(tab.sort as ProductTabSort))
      ) {
        errors.push(
          `product_tabs: tabs[${i}].sort must be one of ${SORTS.join(", ")}`
        )
      }

      if (
        tab.limit !== undefined &&
        (typeof tab.limit !== "number" ||
          !Number.isFinite(tab.limit) ||
          tab.limit < 0)
      ) {
        errors.push(`product_tabs: tabs[${i}].limit must be a non-negative number`)
      }
    })

    return ok(errors)
  },
}

export default productTabsBlock
