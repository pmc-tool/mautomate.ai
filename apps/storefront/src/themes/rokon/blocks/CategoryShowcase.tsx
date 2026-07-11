import { fetchCategoryTiles } from "@modules/cms/blocks/category-showcase-fetch"

import CategoryShowcaseView from "./CategoryShowcaseView"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the category_showcase CMS block ("Our Best        */
/* Projects" grid).                                                     */
/*                                                                      */
/* ASYNC SERVER component: it resolves the live category tiles (item     */
/* counts + hrefs) via the shared ./category-showcase-fetch util — the   */
/* SAME code the editor bridge uses — then hands them to the pure        */
/* CategoryShowcaseView, which owns the Rokon markup. Splitting the      */
/* presentational half out lets the visual-editor canvas render the      */
/* IDENTICAL Rokon markup from client-fetched tiles (WYSIWYG parity).    */
/* Tiles referencing a missing `category_id` are dropped (dangling-ref   */
/* safe); tiles WITHOUT a `category_id` are static and always rendered.  */
/* ------------------------------------------------------------------ */

export interface CategoryShowcaseItem {
  category_id?: string
  label: string
  image: string
  href: string
}

export interface CategoryShowcaseData {
  sub_title?: string
  title: string
  items?: CategoryShowcaseItem[]
  /** Injected by the SectionRenderer from the route (not part of section.data). */
  countryCode?: string
  /** Injected by the SectionRenderer ("sec-<idx>"); unused here. */
  sectionScope?: string
  [key: string]: unknown
}

const CategoryShowcase = async (props: CategoryShowcaseData) => {
  const items = Array.isArray(props.items) ? props.items : []

  const tiles = await fetchCategoryTiles(items)

  return (
    <CategoryShowcaseView
      sub_title={props.sub_title}
      title={props.title}
      tiles={tiles}
      sectionScope={props.sectionScope}
    />
  )
}

export default CategoryShowcase
