import { fetchTabGroups } from "@modules/cms/blocks/product-tabs-fetch"

import ProductTabsView from "./ProductTabsView"

/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the product_tabs CMS block.  */
/*                                                                      */
/* ASYNC SERVER component: it fetches the LIVE region-scoped products    */
/* for each configured tab (via the shared ./product-tabs-fetch util,   */
/* the SAME code the editor bridge uses) then hands the resolved per-tab */
/* `groups` to the pure ProductTabsView, which owns the Aurora markup    */
/* and the three-slot (new / sale / best) data mapping. Splitting the    */
/* presentational half out lets the visual-editor canvas render the      */
/* IDENTICAL Aurora markup from client-fetched groups — WYSIWYG parity.  */
/* A tab whose category / collection / product no longer exists resolves */
/* to an empty group. `countryCode` resolves region-scoped prices; we    */
/* fall back to the default region when it is absent.                    */
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

export interface ProductTabsData {
  tabs?: ProductTab[]
  /** Injected by the SectionRenderer from the route (not part of section.data). */
  countryCode?: string
  [key: string]: unknown
}

const DEFAULT_COUNTRY = process.env.NEXT_PUBLIC_DEFAULT_REGION || "bd"

const ProductTabs = async (props: ProductTabsData) => {
  const tabs = Array.isArray(props.tabs) ? props.tabs : []
  const countryCode = props.countryCode || DEFAULT_COUNTRY

  if (!tabs.length) {
    return null
  }

  const groups = await fetchTabGroups(tabs, countryCode)

  return <ProductTabsView groups={groups} />
}

export default ProductTabs
