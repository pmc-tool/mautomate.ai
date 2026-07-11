/* ------------------------------------------------------------------ */
/* Ekka chrome FOOTER: async SERVER component that self-resolves its     */
/* data (listCategories + getCmsSettings + getBrandName) then renders    */
/* the pure EkkaFooterView with it. Splitting the presentational half    */
/* out lets the visual-editor canvas render the IDENTICAL Ekka footer    */
/* markup from the chrome data it already has (WYSIWYG parity).          */
/* ------------------------------------------------------------------ */

import { listCategories } from "@lib/data/categories"
import { CMS_DEFAULTS, getCmsSettings } from "@lib/data/cms"
import { getBrandName } from "@lib/brand"

import EkkaFooterView from "./EkkaFooterView"

export default async function EkkaFooter() {
  const [categories, settings, brand] = await Promise.all([
    listCategories().catch(() => []),
    getCmsSettings().catch(() => null),
    getBrandName().catch(() => "Forever Finds"),
  ])

  const footer = settings?.footer ?? CMS_DEFAULTS.footer

  return (
    <EkkaFooterView footer={footer} categories={categories} brand={brand} />
  )
}
