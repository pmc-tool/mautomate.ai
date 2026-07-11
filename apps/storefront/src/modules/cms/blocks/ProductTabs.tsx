import LeartsProductTabs from "@modules/home/components/learts/product-tabs"
import {
  DEFAULT_COUNTRY,
  fetchTabSlots,
  type ProductTab,
  type ProductTabSource,
  type ProductTabSort,
} from "./product-tabs-fetch"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend product_tabs resolved schema). */
/* Received as the spread prop bag from the storefront SectionRenderer  */
/* (`<ProductTabs {...block} />`), so it also carries block_type /       */
/* schema_version which we simply ignore.                               */
/*                                                                      */
/* This is an ASYNC SERVER component: it fetches the LIVE products for   */
/* each configured tab (via the shared ./product-tabs-fetch util) and    */
/* feeds them to the existing Learts client tab-switcher (which reuses   */
/* product-card). A tab that references a category / collection /        */
/* product which no longer exists resolves to an empty grid — never       */
/* throws, never crashes the page (dangling-ref safe).                   */
/*                                                                      */
/* `countryCode` is required to resolve a region-scoped price. The       */
/* SectionRenderer is rendered inside the `[countryCode]` route, so the   */
/* integrator passes it through; we fall back to the default region when  */
/* it is absent so the block still renders.                              */
/* ------------------------------------------------------------------ */

// Types live in the shared server util; re-export for the existing consumers
// (backend registry mirrors, editor bridge) that import them from this block.
export type { ProductTab, ProductTabSource, ProductTabSort }

export interface ProductTabsData {
  tabs?: ProductTab[]
  /** Injected by the SectionRenderer from the route (not part of section.data). */
  countryCode?: string
  [key: string]: unknown
}

const ProductTabs = async (props: ProductTabsData) => {
  const tabs = Array.isArray(props.tabs) ? props.tabs : []
  const countryCode = props.countryCode || DEFAULT_COUNTRY

  if (!tabs.length) {
    return null
  }

  // The Learts client switcher exposes three slots (new / sale / best); the
  // shared util maps the first three configured tabs onto them.
  const { newArrivals, saleItems, bestSellers } = await fetchTabSlots(
    tabs,
    countryCode
  )

  if (!newArrivals.length && !saleItems.length && !bestSellers.length) {
    return null
  }

  return (
    <LeartsProductTabs
      newArrivals={newArrivals}
      saleItems={saleItems}
      bestSellers={bestSellers}
    />
  )
}

export default ProductTabs
