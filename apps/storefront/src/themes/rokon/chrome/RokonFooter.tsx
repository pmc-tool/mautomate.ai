/* ------------------------------------------------------------------ */
/* Rokon chrome FOOTER: async SERVER component that self-resolves its    */
/* data (listCategories + getCmsSettings + getBrandName) then renders    */
/* the pure RokonFooterView with it. Splitting the presentational half   */
/* out lets the visual-editor canvas render the IDENTICAL Rokon footer   */
/* markup from the chrome data it already has (WYSIWYG parity).          */
/* ------------------------------------------------------------------ */

import { listCategories } from "@lib/data/categories"
import { CMS_DEFAULTS, getCmsSettings } from "@lib/data/cms"
import { getBrandName } from "@lib/brand"

import RokonFooterView from "./RokonFooterView"

export default async function RokonFooter() {
  const [categories, settings, brand] = await Promise.all([
    listCategories().catch(() => []),
    getCmsSettings().catch(() => null),
    getBrandName().catch(() => "Forever Finds"),
  ])

  const footer = settings?.footer ?? CMS_DEFAULTS.footer

  return (
    <RokonFooterView footer={footer} categories={categories} brand={brand} />
  )
}
