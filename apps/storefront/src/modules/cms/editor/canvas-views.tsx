"use client"

/* ------------------------------------------------------------------ */
/* Editor canvas — CLIENT-safe per-theme View registries               */
/*                                                                     */
/* Each theme's product_tabs / category_showcase block was split into a */
/* pure presentational *View (client-safe: no data fetching, no server- */
/* only imports) + an async server block that fetches then renders it.  */
/* The canvas cannot run the async server block, so it fetches the same */
/* resolved data client-side (from /api/puck/product-tab-groups and     */
/* /api/puck/category-tiles) and renders the ACTIVE theme's View here — */
/* byte-identical to what the live storefront ships for that theme.     */
/*                                                                     */
/* Keyed by theme id. Learts is intentionally absent: it keeps the      */
/* existing Learts client previews (CanvasProductTabs / CanvasCategory- */
/* Showcase fall back to them when no theme View is registered).        */
/* ------------------------------------------------------------------ */

import type { ComponentType } from "react"

import AuroraProductTabsView from "@themes/aurora/blocks/ProductTabsView"
import CignetProductTabsView from "@themes/cignet/blocks/ProductTabsView"
import ShofyProductTabsView from "@themes/shofy/blocks/ProductTabsView"
import EkkaProductTabsView from "@themes/ekka/blocks/ProductTabsView"
import HelendoProductTabsView from "@themes/helendo/blocks/ProductTabsView"
import BazaroProductTabsView from "@themes/bazaro/blocks/ProductTabsView"
import ExzoProductTabsView from "@themes/exzo/blocks/ProductTabsView"
import RokonProductTabsView from "@themes/rokon/blocks/ProductTabsView"

import AuroraCategoryShowcaseView from "@themes/aurora/blocks/CategoryShowcaseView"
import CignetCategoryShowcaseView from "@themes/cignet/blocks/CategoryShowcaseView"
import ShofyCategoryShowcaseView from "@themes/shofy/blocks/CategoryShowcaseView"
import EkkaCategoryShowcaseView from "@themes/ekka/blocks/CategoryShowcaseView"
import HelendoCategoryShowcaseView from "@themes/helendo/blocks/CategoryShowcaseView"
import BazaroCategoryShowcaseView from "@themes/bazaro/blocks/CategoryShowcaseView"
import ExzoCategoryShowcaseView from "@themes/exzo/blocks/CategoryShowcaseView"
import RokonCategoryShowcaseView from "@themes/rokon/blocks/CategoryShowcaseView"

/** theme id -> the theme's pure product_tabs View (fed client-fetched groups). */
export const PRODUCT_TABS_VIEWS: Record<string, ComponentType<any>> = {
  aurora: AuroraProductTabsView,
  cignet: CignetProductTabsView,
  shofy: ShofyProductTabsView,
  ekka: EkkaProductTabsView,
  helendo: HelendoProductTabsView,
  bazaro: BazaroProductTabsView,
  exzo: ExzoProductTabsView,
  rokon: RokonProductTabsView,
}

/** theme id -> the theme's pure category_showcase View (fed client-fetched tiles). */
export const CATEGORY_SHOWCASE_VIEWS: Record<string, ComponentType<any>> = {
  aurora: AuroraCategoryShowcaseView,
  cignet: CignetCategoryShowcaseView,
  shofy: ShofyCategoryShowcaseView,
  ekka: EkkaCategoryShowcaseView,
  helendo: HelendoCategoryShowcaseView,
  bazaro: BazaroCategoryShowcaseView,
  exzo: ExzoCategoryShowcaseView,
  rokon: RokonCategoryShowcaseView,
}
